import json
import logging
import math
import re
from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slugify import slugify
from sqlalchemy import desc, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.modules.auth.deps import get_current_admin, get_current_user, get_optional_user
from app.modules.auth.models import User
from app.modules.blog.models import Category, Chapter, Comment, Post, PostLike, PostReport, Series, SeriesCollaborator, Tag, post_tags
from app.modules.social.models import Follow, Notification
from app.modules.audit.service import record_audit_log
from app.modules.blog.schemas import (
    AuthorBrief,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ChapterCreate,
    ChapterResponse,
    ChapterUpdate,
    ChapterWithLessons,
    CommentCreate,
    CommentReplyResponse,
    CommentResponse,
    CommentUpdate,
    LessonBrief,
    PaginatedPosts,
    PostCreate,
    PostDetail,
    PostListItem,
    PostUpdate,
    SeriesCreate,
    SeriesDetailResponse,
    SeriesResponse,
    SeriesUpdate,
    TagResponse,
)

router = APIRouter(prefix="/blog", tags=["Blog"])
logger = logging.getLogger(__name__)


def calculate_reading_time(text: str) -> int:
    clean_text = re.sub(r"<[^>]+>", " ", text or "")
    words = clean_text.split()
    return max(1, math.ceil(len(words) / 200))


async def normalize_internal_links_in_html(db: AsyncSession, content_html: str) -> str:
    """Tự động phát hiện các thẻ <a> trỏ tới bài viết nội bộ (/posts/[slug] hoặc https://hungph-blog.vercel.app/posts/[slug]).
    Nếu inner text đang là raw URL, tự động thay thế bằng tiêu đề thực tế của bài viết.
    """
    if not content_html:
        return content_html

    pattern = re.compile(
        r'<a\s+([^>]*?)href=["\'](?:https?://(?:hungph-blog\.vercel\.app|localhost:\d+))?/posts/([a-zA-Z0-9_\-]+)["\']([^>]*?)>(.*?)</a>',
        re.IGNORECASE | re.DOTALL
    )

    matches = list(pattern.finditer(content_html))
    if not matches:
        return content_html

    slugs_to_lookup = set()
    for m in matches:
        attrs_before, slug, attrs_after, inner_text = m.groups()
        plain_text = re.sub(r'<[^>]+>', '', inner_text).strip()
        if (
            plain_text.startswith("http://")
            or plain_text.startswith("https://")
            or plain_text.startswith("/posts/")
            or plain_text == slug
        ):
            slugs_to_lookup.add(slug)

    if not slugs_to_lookup:
        return content_html

    stmt = select(Post.slug, Post.title).where(Post.slug.in_(slugs_to_lookup))
    res = await db.execute(stmt)
    slug_title_map = dict(res.fetchall())

    def replace_link(match):
        attrs_before, slug, attrs_after, inner_text = match.groups()
        plain_text = re.sub(r'<[^>]+>', '', inner_text).strip()
        if (
            (plain_text.startswith("http://")
            or plain_text.startswith("https://")
            or plain_text.startswith("/posts/")
            or plain_text == slug)
            and slug in slug_title_map
        ):
            title = slug_title_map[slug]
            return f'<a {attrs_before}href="https://hungph-blog.vercel.app/posts/{slug}"{attrs_after}>{title}</a>'
        return match.group(0)

    return pattern.sub(replace_link, content_html)


async def get_or_create_tags(db: AsyncSession, tag_names: List[str]) -> List[Tag]:
    tags = []
    for name in tag_names:
        clean_name = name.strip()
        if not clean_name:
            continue
        slug = slugify(clean_name)
        stmt = select(Tag).where(Tag.slug == slug)
        res = await db.execute(stmt)
        tag = res.scalar_one_or_none()
        if not tag:
            tag = Tag(name=clean_name, slug=slug)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


async def make_unique_slug(db: AsyncSession, base_text: str, model_cls=Post, current_id: Optional[str] = None) -> str:
    base_slug = slugify(base_text)
    if not base_slug:
        base_slug = "item"
    slug = base_slug
    counter = 1
    while True:
        stmt = select(model_cls).where(model_cls.slug == slug)
        if current_id:
            stmt = stmt.where(model_cls.id != current_id)
        res = await db.execute(stmt)
        if not res.scalar_one_or_none():
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


# --- PUBLIC & LIST POSTS ---

@router.get("/posts", response_model=PaginatedPosts)
async def list_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=500),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    series_id: Optional[str] = None,
    author_id: Optional[str] = None,
    include_drafts: bool = False,
    db: AsyncSession = Depends(get_db),
    optional_user: Optional[User] = Depends(get_optional_user)
):
    offset = (page - 1) * limit
    stmt = (
        select(Post)
        .options(
            selectinload(Post.category),
            selectinload(Post.tags),
            selectinload(Post.author),
            selectinload(Post.series),
            selectinload(Post.chapter),
            selectinload(Post.likes),
        )
    )

    # Bảo mật bản nháp: Chưa đăng nhập hoặc ko chọn include_drafts -> chỉ bài đã xuất bản
    # Nếu là Thành viên: chỉ được xem bản nháp do chính mình tạo
    # Nếu là Admin: được xem mọi bản nháp khi include_drafts=True
    is_admin = bool(optional_user and (optional_user.is_admin or getattr(optional_user, "role", "") == "admin"))
    if not include_drafts or not optional_user:
        stmt = stmt.where(Post.is_published == True)
    elif not is_admin:
        stmt = stmt.where(or_(Post.is_published == True, Post.author_id == optional_user.id))

    if author_id:
        stmt = stmt.where(Post.author_id == author_id)

    if category:
        stmt = stmt.join(Post.category).where(
            or_(Category.slug == category, Category.id == category, Category.name == category)
        )

    if tag:
        stmt = stmt.join(Post.tags).where(Tag.slug == tag)

    if series_id:
        stmt = stmt.where(Post.series_id == series_id)

    if search:
        search_fmt = f"%{search}%"
        stmt = stmt.where(
            or_(
                Post.title.ilike(search_fmt),
                Post.summary.ilike(search_fmt),
                Post.content_html.ilike(search_fmt)
            )
        )

    # Count total
    count_stmt = select(func.count(Post.id))
    if not include_drafts or not optional_user:
        count_stmt = count_stmt.where(Post.is_published == True)
    elif not is_admin:
        count_stmt = count_stmt.where(or_(Post.is_published == True, Post.author_id == optional_user.id))

    if author_id:
        count_stmt = count_stmt.where(Post.author_id == author_id)
    if category:
        count_stmt = count_stmt.join(Post.category).where(
            or_(Category.slug == category, Category.id == category, Category.name == category)
        )
    if tag:
        count_stmt = count_stmt.join(Post.tags).where(Tag.slug == tag)
    if series_id:
        count_stmt = count_stmt.where(Post.series_id == series_id)
    if search:
        search_fmt = f"%{search}%"
        count_stmt = count_stmt.where(
            or_(
                Post.title.ilike(search_fmt),
                Post.summary.ilike(search_fmt),
                Post.content_html.ilike(search_fmt)
            )
        )
        search_fmt = f"%{search}%"
        count_stmt = count_stmt.where(
            or_(
                Post.title.ilike(search_fmt),
                Post.summary.ilike(search_fmt),
                Post.content_html.ilike(search_fmt)
            )
        )
    
    total_count_res = await db.execute(count_stmt)
    total = total_count_res.scalar_one()

    # Order and paginate
    stmt = stmt.order_by(desc(Post.published_at), desc(Post.created_at)).offset(offset).limit(limit)
    res = await db.execute(stmt)
    posts = res.scalars().all()

    total_pages = math.ceil(total / limit) if total > 0 else 1

    return PaginatedPosts(
        items=[PostListItem.model_validate(p) for p in posts],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )



@router.get("/posts/spotlight", response_model=Optional[PostListItem])
async def get_spotlight_post(db: AsyncSession = Depends(get_db)):
    """Trả về bài viết được Admin đặt làm Spotlight Headline trên trang chủ.
    Nếu chưa có bài nào được đặt spotlight, trả về None (frontend tự fallback về bài mới nhất).
    """
    stmt = (
        select(Post)
        .where(Post.is_spotlight == True, Post.is_published == True)
        .options(
            selectinload(Post.category),
            selectinload(Post.tags),
            selectinload(Post.author),
            selectinload(Post.series),
            selectinload(Post.likes),
        )
        .limit(1)
    )
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()
    if not post:
        return None
    return PostListItem.model_validate(post)


@router.get("/posts/{slug}", response_model=PostDetail)
async def get_post_by_slug(
    slug: str,
    increment_view: bool = True,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Post)
        .where(Post.slug == slug)
        .options(
            selectinload(Post.category),
            selectinload(Post.tags),
            selectinload(Post.author),
            selectinload(Post.series),
            selectinload(Post.chapter),
            selectinload(Post.likes),
        )
    )
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if increment_view and post.is_published:
        post.views_count = (post.views_count or 0) + 1
        await db.commit()
        await db.refresh(post)

    post_detail = PostDetail.model_validate(post)

    # Nếu bài viết thuộc 1 Course/Series, tải toàn bộ dàn outline và bài trước/sau
    if post.series_id:
        series_stmt = (
            select(Series)
            .where(Series.id == post.series_id)
            .options(
                selectinload(Series.category),
                selectinload(Series.chapters).selectinload(Chapter.posts),
            )
        )
        s_res = await db.execute(series_stmt)
        series_obj = s_res.scalar_one_or_none()
        if series_obj:
            chapters_data = []
            all_ordered_lessons: List[Post] = []

            # Sắp xếp chương theo cấu trúc phả hệ: Cấp to (root) -> Cấp bé (children) -> Bài học
            ch_map = {ch.id: ch for ch in series_obj.chapters}
            children_map = {}
            roots = []
            for ch in series_obj.chapters:
                if ch.parent_id and ch.parent_id in ch_map:
                    children_map.setdefault(ch.parent_id, []).append(ch)
                else:
                    roots.append(ch)

            roots.sort(key=lambda c: c.order)
            for p_id in children_map:
                children_map[p_id].sort(key=lambda c: c.order)

            ordered_chapters = []
            def traverse_chapters(ch_node):
                ordered_chapters.append(ch_node)
                for child in children_map.get(ch_node.id, []):
                    traverse_chapters(child)

            for r in roots:
                traverse_chapters(r)

            for ch in ordered_chapters:
                ch_posts = [p for p in ch.posts if p.is_published]
                ch_posts.sort(key=lambda p: p.order_in_chapter or 1)
                all_ordered_lessons.extend(ch_posts)
                chapters_data.append(
                    ChapterWithLessons(
                        id=ch.id,
                        series_id=ch.series_id,
                        title=ch.title,
                        order=ch.order,
                        description=ch.description,
                        parent_id=ch.parent_id,
                        level=ch.level or 1,
                        created_at=ch.created_at,
                        lessons=[LessonBrief.model_validate(p) for p in ch_posts]
                    )
                )

            post_detail.series_outline = SeriesDetailResponse(
                id=series_obj.id,
                title=series_obj.title,
                slug=series_obj.slug,
                summary=series_obj.summary,
                cover_image=series_obj.cover_image,
                is_published=series_obj.is_published,
                category_id=series_obj.category_id,
                hierarchy_config=series_obj.hierarchy_config,
                attribution_text=series_obj.attribution_text,
                created_at=series_obj.created_at,
                category=CategoryResponse.model_validate(series_obj.category) if series_obj.category else None,
                total_chapters=len(chapters_data),
                total_lessons=len(all_ordered_lessons),
                chapters=chapters_data
            )

            # Tính toán Prev / Next post trong khóa học
            for idx, item in enumerate(all_ordered_lessons):
                if item.id == post.id:
                    if idx > 0:
                        post_detail.prev_post = LessonBrief.model_validate(all_ordered_lessons[idx - 1])
                    if idx < len(all_ordered_lessons) - 1:
                        post_detail.next_post = LessonBrief.model_validate(all_ordered_lessons[idx + 1])
                    break

    return post_detail


@router.get("/posts/id/{post_id}", response_model=PostDetail)
async def get_post_by_id(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(Post)
        .where(Post.id == post_id)
        .options(
            selectinload(Post.category),
            selectinload(Post.tags),
            selectinload(Post.author),
            selectinload(Post.series),
            selectinload(Post.chapter),
        )
    )
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    is_admin = (current_user.is_admin or getattr(current_user, "role", "") == "admin")
    if not is_admin and post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập bài viết này")

    post_detail = PostDetail.model_validate(post)
    if post.series:
        post_detail.series_outline = SeriesDetailResponse(
            id=post.series.id,
            title=post.series.title,
            slug=post.series.slug,
            summary=post.series.summary,
            cover_image=post.series.cover_image,
            is_published=post.series.is_published,
            category_id=post.series.category_id,
            hierarchy_config=post.series.hierarchy_config,
            attribution_text=post.series.attribution_text,
            created_at=post.series.created_at,
            category=CategoryResponse.model_validate(post.series.category) if post.series.category else None,
            total_chapters=0,
            total_lessons=0,
            chapters=[]
        )
    return post_detail


async def check_series_write_permission(db: AsyncSession, series_id: str, user: User):
    """Kiểm tra quyền gán bài viết vào khoá học: chỉ admin, tác giả sở hữu hoặc cộng tác viên được chấp nhận."""
    is_admin = user.is_admin or getattr(user, "role", "") == "admin"
    if is_admin:
        return
    stmt = select(Series).where(Series.id == series_id)
    series = (await db.execute(stmt)).scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Khoá học không tồn tại")
    if series.owner_id == user.id:
        return
    collab = (await db.execute(
        select(SeriesCollaborator).where(
            SeriesCollaborator.series_id == series_id,
            SeriesCollaborator.user_id == user.id,
            SeriesCollaborator.status == "accepted"
        )
    )).scalar_one_or_none()
    if not collab:
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền thêm bài viết vào khoá học của người khác. Vui lòng gửi yêu cầu cộng tác trước!"
        )


async def check_series_edit_permission(db: AsyncSession, series_id: str, user: User) -> Series:
    """Kiểm tra quyền chỉnh sửa cấu trúc khoá học: admin, tác giả sở hữu hoặc cộng tác viên."""
    stmt = select(Series).where(Series.id == series_id).options(selectinload(Series.chapters), selectinload(Series.category))
    res = await db.execute(stmt)
    series = res.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Khoá học không tồn tại")
    is_admin = user.is_admin or getattr(user, "role", "") == "admin"
    if is_admin or series.owner_id == user.id:
        return series
    collab = (await db.execute(
        select(SeriesCollaborator).where(
            SeriesCollaborator.series_id == series_id,
            SeriesCollaborator.user_id == user.id,
            SeriesCollaborator.status == "accepted"
        )
    )).scalar_one_or_none()
    if not collab:
        raise HTTPException(status_code=403, detail="Bạn không có quyền chỉnh sửa khoá học này")
    return series


async def validate_post_series_hierarchy(
    db: AsyncSession,
    series_id: Optional[str],
    chapter_id: Optional[str],
) -> Optional[Chapter]:
    """
    Kiểm tra tính hợp lệ của phân cấp khóa học khi viết/sửa bài:
    - Nếu bài viết thuộc khóa học có cấu hình phân cấp (N cấp), bài viết PHẢI chọn đủ tất cả các cấp (gán vào chapter cấp N).
    - Chapter được chọn phải thuộc series đó và có level == len(hierarchy_levels).
    - Chuỗi parent_id phải nối liên tục từ level N lên level 1.
    """
    if not series_id:
        return None

    stmt = select(Series).where(Series.id == series_id)
    series_res = await db.execute(stmt)
    series = series_res.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Khóa học không tồn tại")

    levels: List[str] = []
    if series.hierarchy_config:
        try:
            parsed = json.loads(series.hierarchy_config)
            if isinstance(parsed, list) and len(parsed) > 0:
                levels = [str(lvl).strip() for lvl in parsed if str(lvl).strip()]
        except Exception:
            pass

    if not levels:
        return None

    expected_depth = len(levels)

    if not chapter_id:
        levels_str = " > ".join(levels)
        raise HTTPException(
            status_code=400,
            detail=f"Bài viết thuộc khóa học '{series.title}' yêu cầu phải chọn đầy đủ {expected_depth} cấp phân mục ({levels_str})."
        )

    ch_stmt = select(Chapter).where(Chapter.id == chapter_id)
    ch_res = await db.execute(ch_stmt)
    chapter = ch_res.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=400, detail="Mục phân cấp đã chọn không tồn tại")

    if chapter.series_id != series.id:
        raise HTTPException(status_code=400, detail="Mục phân cấp không thuộc khóa học này")

    if (chapter.level or 1) != expected_depth:
        leaf_name = levels[-1]
        raise HTTPException(
            status_code=400,
            detail=f"Bài viết phải được xếp vào cấp cuối cùng '{leaf_name}' (Cấp {expected_depth}/{expected_depth}). Mục đang chọn thuộc cấp {chapter.level or 1}."
        )

    # Lần ngược cây phả hệ để đảm bảo chuỗi parent_id hợp lệ từ level N lên level 1
    curr = chapter
    for expected_lvl in range(expected_depth, 1, -1):
        if not curr.parent_id:
            parent_level_name = levels[expected_lvl - 2] if expected_lvl - 2 < len(levels) else f"Cấp {expected_lvl - 1}"
            raise HTTPException(
                status_code=400,
                detail=f"Cấu trúc phân cấp không hoàn chỉnh: Mục '{curr.title}' ở cấp {curr.level or 1} thiếu mục cha ở cấp '{parent_level_name}'."
            )
        p_stmt = select(Chapter).where(Chapter.id == curr.parent_id)
        p_res = await db.execute(p_stmt)
        parent_ch = p_res.scalar_one_or_none()
        if not parent_ch or parent_ch.series_id != series.id:
            raise HTTPException(status_code=400, detail=f"Không tìm thấy mục cha hợp lệ của '{curr.title}'.")
        curr = parent_ch

    return chapter


async def notify_followers_new_post(db: AsyncSession, post: Post, author: User):
    """Gửi thông báo bài viết mới tới những người đang theo dõi tác giả."""
    try:
        followers_stmt = select(Follow.follower_id).where(Follow.following_id == author.id)
        result = await db.execute(followers_stmt)
        follower_ids = [r[0] for r in result.fetchall()]
        if not follower_ids:
            return
        author_name = author.full_name or author.username
        for fid in follower_ids:
            db.add(Notification(
                user_id=fid,
                actor_id=author.id,
                type="new_post",
                target_id=post.id,
                target_type="post",
                message=f"{author_name} vừa đăng bài viết mới: '{post.title}'"
            ))
        await db.commit()
    except Exception as e:
        print(f"Error notifying followers: {e}")


# --- POSTS CRUD (Member: Own posts | Admin: All posts) ---

@router.post("/posts", response_model=PostDetail, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_in: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if post_in.series_id:
        await check_series_write_permission(db, post_in.series_id, current_user)
        await validate_post_series_hierarchy(db, post_in.series_id, post_in.chapter_id)

    slug = await make_unique_slug(db, post_in.slug or post_in.title, model_cls=Post)
    reading_time = calculate_reading_time(post_in.content_html or post_in.content_markdown or "")
    tags = await get_or_create_tags(db, post_in.tags) if post_in.tags else []

    now = datetime.now(timezone.utc)
    published_at = now if post_in.is_published else None

    # Auto inherit category from series if not specified
    category_id = post_in.category_id if post_in.category_id != "" else None
    if not category_id and post_in.series_id:
        s_cat_stmt = select(Series.category_id).where(Series.id == post_in.series_id)
        category_id = (await db.execute(s_cat_stmt)).scalar_one_or_none()

    post_order = post_in.order_in_chapter or 1
    if post_in.chapter_id:
        shift_post_stmt = (
            update(Post)
            .where(
                Post.chapter_id == post_in.chapter_id,
                Post.order_in_chapter >= post_order
            )
            .values(order_in_chapter=Post.order_in_chapter + 1)
        )
        await db.execute(shift_post_stmt)

    raw_content_html = post_in.content_html or ""
    content_html = await normalize_internal_links_in_html(db, raw_content_html)
    reading_time = calculate_reading_time(content_html or post_in.content_markdown or "")

    new_post = Post(
        title=post_in.title.strip(),
        slug=slug,
        summary=post_in.summary.strip() if post_in.summary else None,
        content_html=content_html,
        content_markdown=post_in.content_markdown,
        cover_image=post_in.cover_image,
        is_published=post_in.is_published,
        published_at=published_at,
        reading_time_minutes=reading_time,
        author_id=current_user.id,
        category_id=category_id,
        series_id=post_in.series_id if post_in.series_id != "" else None,
        chapter_id=post_in.chapter_id if post_in.chapter_id != "" else None,
        order_in_chapter=post_in.order_in_chapter or 1,
        tags=tags
    )
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

    if new_post.is_published:
        await notify_followers_new_post(db, new_post, current_user)
        try:
            import asyncio
            from app.modules.rag.service import update_post_in_index
            post_dict = {
                "id": new_post.id,
                "title": new_post.title,
                "slug": new_post.slug,
                "summary": new_post.summary or "",
                "content_html": new_post.content_html or "",
                "content_markdown": new_post.content_markdown or "",
            }
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()
            loop.run_in_executor(None, update_post_in_index, post_dict)
        except Exception as rag_err:
            logger.warning(f"RAG auto-index on create warning: {rag_err}")

    # Ghi audit log đăng bài mới
    try:
        status_str = "Đã xuất bản" if new_post.is_published else "Bản nháp"
        await record_audit_log(
            db=db,
            action="POST_CREATE",
            summary=f"{current_user.full_name or current_user.username} đã đăng bài mới: '{new_post.title}' ({status_str})",
            user=current_user,
            target_type="post",
            target_id=new_post.slug,
            target_title=new_post.title,
            details={
                "post_id": new_post.id,
                "is_published": new_post.is_published,
                "series_id": new_post.series_id,
            },
            request=request,
        )
    except Exception:
        pass

    stmt = (
        select(Post)
        .where(Post.id == new_post.id)
        .options(
            selectinload(Post.category),
            selectinload(Post.tags),
            selectinload(Post.author),
            selectinload(Post.series),
            selectinload(Post.chapter),
        )
    )
    res = await db.execute(stmt)
    refreshed_post = res.scalar_one()
    return PostDetail.model_validate(refreshed_post)


@router.put("/posts/{post_id}", response_model=PostDetail)
async def update_post(
    post_id: str,
    post_in: PostUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(Post)
        .where(Post.id == post_id)
        .options(
            selectinload(Post.category),
            selectinload(Post.tags),
            selectinload(Post.author),
            selectinload(Post.series),
            selectinload(Post.chapter),
        )
    )
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    is_admin = (current_user.is_admin or getattr(current_user, "role", "") == "admin")
    if not is_admin and post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn chỉ có quyền chỉnh sửa bài viết của chính mình")

    if post_in.series_id is not None and post_in.series_id != "" and post_in.series_id != post.series_id:
        await check_series_write_permission(db, post_in.series_id, current_user)

    was_published = post.is_published

    if post_in.title is not None:
        post.title = post_in.title.strip()
    if post_in.slug is not None and post_in.slug.strip():
        post.slug = await make_unique_slug(db, post_in.slug, model_cls=Post, current_id=post.id)
    elif post_in.title is not None and (post_in.slug is None or post_in.slug == ""):
        # Tự động cập nhật slug theo tiêu đề mới nếu slug không được chỉ định riêng
        post.slug = await make_unique_slug(db, post_in.title, model_cls=Post, current_id=post.id)

    if post_in.summary is not None:
        post.summary = post_in.summary.strip() if post_in.summary else None
    if post_in.content_html is not None:
        post.content_html = await normalize_internal_links_in_html(db, post_in.content_html)
        post.reading_time_minutes = calculate_reading_time(post.content_html)
    if post_in.content_markdown is not None:
        post.content_markdown = post_in.content_markdown
    if post_in.cover_image is not None:
        post.cover_image = post_in.cover_image.strip() if post_in.cover_image.strip() else None

    if post_in.series_id is not None:
        post.series_id = post_in.series_id if post_in.series_id != "" else None
        if not post.series_id:
            post.chapter_id = None
    if post_in.chapter_id is not None and post.series_id:
        post.chapter_id = post_in.chapter_id if post_in.chapter_id != "" else None
    if post_in.order_in_chapter is not None:
        post.order_in_chapter = post_in.order_in_chapter

    if post.series_id:
        await validate_post_series_hierarchy(db, post.series_id, post.chapter_id)

    if post_in.category_id is not None and post_in.category_id != "":
        post.category_id = post_in.category_id
    elif (post_in.category_id == "" or post.category_id is None) and (post_in.series_id or post.series_id):
        target_s_id = post_in.series_id or post.series_id
        s_cat_stmt = select(Series.category_id).where(Series.id == target_s_id)
        s_cat = (await db.execute(s_cat_stmt)).scalar_one_or_none()
        if s_cat:
            post.category_id = s_cat

    if post_in.is_published is not None:
        if post_in.is_published and not post.is_published and not post.published_at:
            post.published_at = datetime.now(timezone.utc)
        post.is_published = post_in.is_published

    if post_in.is_spotlight is not None:
        if post_in.is_spotlight:
            # Unset any existing spotlight post first (only one at a time)
            await db.execute(
                text("UPDATE posts SET is_spotlight = FALSE WHERE is_spotlight = TRUE AND id != :pid"),
                {"pid": post.id}
            )
        post.is_spotlight = post_in.is_spotlight

    if post_in.tags is not None:
        post.tags = await get_or_create_tags(db, post_in.tags)

    await db.commit()
    await db.refresh(post)

    if post.is_published and not was_published:
        await notify_followers_new_post(db, post, current_user)

    # Ghi audit log cập nhật bài viết
    try:
        action_type = "POST_UPDATE"
        if post_in.is_published is not None and post_in.is_published != was_published:
            action_type = "POST_PUBLISH" if post.is_published else "POST_UNPUBLISH"

        status_str = "Đã xuất bản" if post.is_published else "Bản nháp"
        await record_audit_log(
            db=db,
            action=action_type,
            summary=f"{current_user.full_name or current_user.username} đã cập nhật bài viết: '{post.title}' ({status_str})",
            user=current_user,
            target_type="post",
            target_id=post.slug,
            target_title=post.title,
            details={
                "post_id": post.id,
                "is_published": post.is_published,
                "was_published": was_published,
                "action_type": action_type,
            },
            request=request,
        )
    except Exception:
        pass

    # RAG Auto-index: cập nhật vector index cho bài viết này
    if post.is_published:
        try:
            import asyncio
            from app.modules.rag.service import update_post_in_index
            post_dict = {
                "id": post.id,
                "title": post.title,
                "slug": post.slug,
                "summary": post.summary or "",
                "content_html": post.content_html or "",
                "content_markdown": post.content_markdown or "",
            }
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()
            loop.run_in_executor(None, update_post_in_index, post_dict)
        except Exception as rag_err:
            logger.warning(f"RAG auto-index warning: {rag_err}")

    # Re-query with all relations eagerly loaded so PostDetail.model_validate succeeds
    stmt = (
        select(Post)
        .where(Post.id == post.id)
        .options(
            selectinload(Post.category),
            selectinload(Post.tags),
            selectinload(Post.author),
            selectinload(Post.series),
            selectinload(Post.chapter),
        )
    )
    res = await db.execute(stmt)
    refreshed_post = res.scalar_one()

    return PostDetail.model_validate(refreshed_post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Post).where(Post.id == post_id)
    res = await db.execute(stmt)
    post = res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    is_admin = (current_user.is_admin or getattr(current_user, "role", "") == "admin")
    if not is_admin and post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn chỉ có quyền xóa bài viết của chính mình")

    post_title = post.title
    post_slug = post.slug
    post_author_id = post.author_id

    await db.delete(post)
    await db.commit()

    # Ghi audit log xóa bài viết
    try:
        await record_audit_log(
            db=db,
            action="POST_DELETE",
            summary=f"{current_user.full_name or current_user.username} đã xóa bài viết: '{post_title}'",
            user=current_user,
            target_type="post",
            target_id=post_id,
            target_title=post_title,
            details={"slug": post_slug, "author_id": post_author_id},
            request=request,
        )
    except Exception:
        pass

    return None


# --- CATEGORIES CRUD (Admin & Public) ---

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Category, func.count(Post.id).label("p_count"))
        .outerjoin(Post, Post.category_id == Category.id)
        .group_by(Category.id)
        .order_by(Category.name)
    )
    res = await db.execute(stmt)
    rows = res.all()
    results = []
    for cat, count in rows:
        c_dict = CategoryResponse.model_validate(cat)
        c_dict.post_count = count
        results.append(c_dict)
    return results


@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    cat_in: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    slug = slugify(cat_in.name)
    stmt = select(Category).where((Category.slug == slug) | (Category.name == cat_in.name))
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Danh mục này đã tồn tại")

    cat = Category(name=cat_in.name.strip(), slug=slug, description=cat_in.description)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    resp = CategoryResponse.model_validate(cat)
    resp.post_count = 0
    return resp


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    cat_in: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(Category).where(Category.id == category_id)
    res = await db.execute(stmt)
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if cat_in.name:
        cat.name = cat_in.name.strip()
    if cat_in.slug:
        cat.slug = slugify(cat_in.slug)
    elif cat_in.name:
        cat.slug = slugify(cat_in.name)
    if cat_in.description is not None:
        cat.description = cat_in.description

    await db.commit()
    await db.refresh(cat)
    return CategoryResponse.model_validate(cat)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(Category).where(Category.id == category_id)
    res = await db.execute(stmt)
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return None


# --- TAGS ---

@router.get("/tags", response_model=List[TagResponse])
async def list_tags(db: AsyncSession = Depends(get_db)):
    stmt = select(Tag).order_by(Tag.name)
    res = await db.execute(stmt)
    tags = res.scalars().all()
    return [TagResponse.model_validate(t) for t in tags]


# --- SERIES / COURSES (Quản lý Khóa học, Tuyển tập & Outline) ---

@router.get("/series", response_model=List[SeriesResponse])
async def list_series(
    include_drafts: bool = False,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Series)
        .options(
            selectinload(Series.owner),
            selectinload(Series.category),
            selectinload(Series.chapters).selectinload(Chapter.posts),
            selectinload(Series.posts)
        )
    )
    if not include_drafts:
        stmt = stmt.where(Series.is_published == True)
    
    stmt = stmt.order_by(desc(Series.created_at))
    res = await db.execute(stmt)
    series_list = res.scalars().all()

    output = []
    for s in series_list:
        tot_chapters = len(s.chapters)
        tot_lessons = sum(len(ch.posts) for ch in s.chapters)
        all_lessons = []
        seen_post_ids = set()
        for ch in s.chapters:
            for p in ch.posts:
                if p.id not in seen_post_ids:
                    seen_post_ids.add(p.id)
                    all_lessons.append(p)
        for p in (s.posts or []):
            if p.id not in seen_post_ids:
                seen_post_ids.add(p.id)
                all_lessons.append(p)

        tot_reading_time = sum(p.reading_time_minutes or 1 for p in all_lessons)
        if tot_lessons == 0 and len(all_lessons) > 0:
            tot_lessons = len(all_lessons)

        author_brief = AuthorBrief.model_validate(s.owner) if s.owner else None

        s_resp = SeriesResponse(
            id=s.id,
            title=s.title,
            slug=s.slug,
            summary=s.summary,
            cover_image=s.cover_image,
            is_published=s.is_published,
            category_id=s.category_id,
            hierarchy_config=s.hierarchy_config,
            attribution_text=s.attribution_text,
            created_at=s.created_at,
            category=CategoryResponse.model_validate(s.category) if s.category else None,
            author=author_brief,
            author_id=s.owner_id,
            total_chapters=tot_chapters,
            total_lessons=tot_lessons,
            total_reading_time_minutes=tot_reading_time
        )
        output.append(s_resp)
    return output


@router.get("/series/writeable", response_model=List[SeriesResponse])
async def list_writeable_series(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trả về danh sách khóa học mà người dùng hiện tại có quyền viết/gán bài vào:
    - Admin: Tất cả khóa học
    - Thành viên: Chỉ các khóa học mà mình là Tác giả sở hữu (owner_id) hoặc Cộng tác viên đã được duyệt (accepted)
    """
    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    stmt = (
        select(Series)
        .options(
            selectinload(Series.owner),
            selectinload(Series.category),
            selectinload(Series.chapters).selectinload(Chapter.posts),
            selectinload(Series.posts)
        )
        .order_by(desc(Series.created_at))
    )

    if not is_admin:
        collab_subquery = (
            select(SeriesCollaborator.series_id)
            .where(
                SeriesCollaborator.user_id == current_user.id,
                SeriesCollaborator.status == "accepted"
            )
        )
        stmt = stmt.where(
            or_(
                Series.owner_id == current_user.id,
                Series.id.in_(collab_subquery)
            )
        )

    res = await db.execute(stmt)
    series_list = res.scalars().all()

    output = []
    for s in series_list:
        tot_chapters = len(s.chapters)
        tot_lessons = sum(len(ch.posts) for ch in s.chapters)
        author_brief = AuthorBrief.model_validate(s.owner) if s.owner else None
        output.append(
            SeriesResponse(
                id=s.id,
                title=s.title,
                slug=s.slug,
                summary=s.summary,
                cover_image=s.cover_image,
                is_published=s.is_published,
                category_id=s.category_id,
                hierarchy_config=s.hierarchy_config,
                attribution_text=s.attribution_text,
                created_at=s.created_at,
                category=CategoryResponse.model_validate(s.category) if s.category else None,
                author=author_brief,
                author_id=s.owner_id,
                total_chapters=tot_chapters,
                total_lessons=tot_lessons,
                total_reading_time_minutes=0
            )
        )
    return output


@router.get("/series/{slug}", response_model=SeriesDetailResponse)
async def get_series_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Series)
        .where(Series.slug == slug)
        .options(
            selectinload(Series.owner),
            selectinload(Series.category),
            selectinload(Series.chapters).selectinload(Chapter.posts),
            selectinload(Series.posts),
        )
    )
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Khóa học không tồn tại")

    chapters_data = []
    total_lessons = 0
    all_lessons = []
    seen_post_ids = set()
    for ch in sorted(s.chapters, key=lambda c: c.order):
        posts = sorted(ch.posts, key=lambda p: p.order_in_chapter or 1)
        total_lessons += len(posts)
        for p in posts:
            if p.id not in seen_post_ids:
                seen_post_ids.add(p.id)
                all_lessons.append(p)
        chapters_data.append(
            ChapterWithLessons(
                id=ch.id,
                series_id=ch.series_id,
                title=ch.title,
                order=ch.order,
                description=ch.description,
                parent_id=ch.parent_id,
                level=ch.level or 1,
                created_at=ch.created_at,
                lessons=[LessonBrief.model_validate(p) for p in posts]
            )
        )

    for p in (s.posts or []):
        if p.id not in seen_post_ids:
            seen_post_ids.add(p.id)
            all_lessons.append(p)

    tot_reading_time = sum(p.reading_time_minutes or 1 for p in all_lessons)
    author_brief = AuthorBrief.model_validate(s.owner) if s.owner else None

    return SeriesDetailResponse(
        id=s.id,
        title=s.title,
        slug=s.slug,
        summary=s.summary,
        cover_image=s.cover_image,
        is_published=s.is_published,
        category_id=s.category_id,
        hierarchy_config=s.hierarchy_config,
        attribution_text=s.attribution_text,
        created_at=s.created_at,
        category=CategoryResponse.model_validate(s.category) if s.category else None,
        author=author_brief,
        author_id=s.owner_id,
        total_chapters=len(chapters_data),
        total_lessons=total_lessons,
        total_reading_time_minutes=tot_reading_time,
        chapters=chapters_data
    )


@router.post("/series", response_model=SeriesResponse, status_code=status.HTTP_201_CREATED)
async def create_series(
    series_in: SeriesCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    slug = await make_unique_slug(db, series_in.slug or series_in.title, model_cls=Series)
    
    owner_user = admin
    if series_in.author_id and series_in.author_id.strip():
        target_u = (await db.execute(select(User).where(User.id == series_in.author_id.strip()))).scalar_one_or_none()
        if target_u:
            owner_user = target_u

    new_series = Series(
        title=series_in.title.strip(),
        slug=slug,
        summary=series_in.summary,
        cover_image=series_in.cover_image,
        is_published=series_in.is_published,
        owner_id=owner_user.id,
        category_id=series_in.category_id if series_in.category_id != "" else None,
        hierarchy_config=series_in.hierarchy_config or '["Chương"]',
        attribution_text=series_in.attribution_text
    )
    db.add(new_series)
    await db.commit()
    await db.refresh(new_series)

    return SeriesResponse(
        id=new_series.id,
        title=new_series.title,
        slug=new_series.slug,
        summary=new_series.summary,
        cover_image=new_series.cover_image,
        is_published=new_series.is_published,
        category_id=new_series.category_id,
        hierarchy_config=new_series.hierarchy_config,
        attribution_text=new_series.attribution_text,
        created_at=new_series.created_at,
        category=CategoryResponse.model_validate(new_series.category) if new_series.category else None,
        author=AuthorBrief.model_validate(owner_user) if owner_user else None,
        author_id=owner_user.id if owner_user else None,
        total_chapters=0,
        total_lessons=0
    )


@router.put("/series/{series_id}", response_model=SeriesResponse)
async def update_series(
    series_id: str,
    series_in: SeriesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    s = await check_series_edit_permission(db, series_id, current_user)

    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    if not is_admin and s.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Cộng tác viên chỉ có quyền biên soạn bài viết và dàn ý, không thể thay đổi thông tin cài đặt chung của khóa học"
        )

    if series_in.title:
        s.title = series_in.title.strip()
    if series_in.slug:
        s.slug = await make_unique_slug(db, series_in.slug, model_cls=Series, current_id=s.id)
    if series_in.summary is not None:
        s.summary = series_in.summary
    if series_in.cover_image is not None:
        s.cover_image = series_in.cover_image.strip() if series_in.cover_image.strip() else None
    if series_in.is_published is not None:
        s.is_published = series_in.is_published
    if series_in.category_id is not None:
        s.category_id = series_in.category_id if series_in.category_id != "" else None
    if series_in.hierarchy_config is not None:
        s.hierarchy_config = series_in.hierarchy_config
    if series_in.attribution_text is not None:
        s.attribution_text = series_in.attribution_text

    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    if series_in.author_id is not None:
        if not is_admin:
            raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền đổi tác giả của khóa học")
        target_author_id = series_in.author_id.strip() if series_in.author_id.strip() else None
        if target_author_id:
            user_exists = (await db.execute(select(User).where(User.id == target_author_id))).scalar_one_or_none()
            if not user_exists:
                raise HTTPException(status_code=400, detail="Tác giả được chọn không tồn tại")
            s.owner_id = target_author_id
        else:
            s.owner_id = None

    await db.commit()

    # Re-query with all relations loaded for full response
    stmt = (
        select(Series)
        .where(Series.id == s.id)
        .options(
            selectinload(Series.owner),
            selectinload(Series.category),
            selectinload(Series.chapters).selectinload(Chapter.posts),
            selectinload(Series.posts)
        )
    )
    res = await db.execute(stmt)
    s = res.scalar_one()

    tot_chapters = len(s.chapters)
    tot_lessons = sum(len(ch.posts) for ch in s.chapters)
    all_lessons = []
    seen_post_ids = set()
    for ch in s.chapters:
        for p in ch.posts:
            if p.id not in seen_post_ids:
                seen_post_ids.add(p.id)
                all_lessons.append(p)
    for p in (s.posts or []):
        if p.id not in seen_post_ids:
            seen_post_ids.add(p.id)
            all_lessons.append(p)

    tot_reading_time = sum(p.reading_time_minutes or 1 for p in all_lessons)
    if tot_lessons == 0 and len(all_lessons) > 0:
        tot_lessons = len(all_lessons)

    return SeriesResponse(
        id=s.id,
        title=s.title,
        slug=s.slug,
        summary=s.summary,
        cover_image=s.cover_image,
        is_published=s.is_published,
        category_id=s.category_id,
        hierarchy_config=s.hierarchy_config,
        attribution_text=s.attribution_text,
        created_at=s.created_at,
        category=CategoryResponse.model_validate(s.category) if s.category else None,
        author=AuthorBrief.model_validate(s.owner) if s.owner else None,
        author_id=s.owner_id,
        total_chapters=tot_chapters,
        total_lessons=tot_lessons,
        total_reading_time_minutes=tot_reading_time
    )


@router.delete("/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_series(
    series_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Series).where(Series.id == series_id)
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")
    
    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    if not is_admin and s.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Chỉ tác giả sở hữu hoặc Admin mới có quyền xóa khoá học này")

    await db.delete(s)
    await db.commit()
    return None


# --- CHAPTERS CRUD ---

@router.post("/series/{series_id}/chapters", response_model=ChapterResponse)
async def add_chapter_to_series(
    series_id: str,
    chapter_in: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    series = await check_series_edit_permission(db, series_id, current_user)

    parent_id = chapter_in.parent_id if chapter_in.parent_id != "" else None
    computed_level = 1
    if parent_id:
        p_stmt = select(Chapter).where(Chapter.id == parent_id, Chapter.series_id == series_id)
        p_res = await db.execute(p_stmt)
        parent_ch = p_res.scalar_one_or_none()
        if not parent_ch:
            raise HTTPException(status_code=400, detail="Mục cha (parent) không tồn tại hoặc không thuộc khóa học này")
        computed_level = (parent_ch.level or 1) + 1
    elif chapter_in.level and chapter_in.level > 1:
        computed_level = chapter_in.level
    else:
        computed_level = 1

    # Kiểm tra không vượt quá số cấp của khóa học nếu đã định hình cấu trúc
    if series.hierarchy_config:
        try:
            parsed = json.loads(series.hierarchy_config)
            if isinstance(parsed, list) and len(parsed) > 0:
                if computed_level > len(parsed):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cấp độ mới (Cấp {computed_level}) vượt quá số cấp tối đa của khóa học ({len(parsed)} cấp: {', '.join(parsed)})."
                    )
        except (json.JSONDecodeError, TypeError):
            pass

    # Xác định thứ tự hiển thị (order) và dịch chuyển các mục phía sau nếu chèn vào giữa/đầu
    p_filter = (Chapter.parent_id == parent_id) if parent_id else Chapter.parent_id.is_(None)
    max_order_stmt = select(func.max(Chapter.order)).where(
        Chapter.series_id == series_id,
        p_filter
    )
    max_res = (await db.execute(max_order_stmt)).scalar() or 0

    if chapter_in.order is None or chapter_in.order > max_res:
        computed_order = max_res + 1
    else:
        computed_order = max(1, chapter_in.order)
        shift_stmt = (
            update(Chapter)
            .where(
                Chapter.series_id == series_id,
                p_filter,
                Chapter.order >= computed_order
            )
            .values(order=Chapter.order + 1)
        )
        await db.execute(shift_stmt)

    ch = Chapter(
        series_id=series_id,
        title=chapter_in.title.strip(),
        order=computed_order,
        description=chapter_in.description,
        parent_id=parent_id,
        level=computed_level
    )
    db.add(ch)
    await db.commit()
    await db.refresh(ch)
    return ChapterResponse.model_validate(ch)


@router.put("/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: str,
    ch_in: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    res = await db.execute(stmt)
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    await check_series_edit_permission(db, ch.series_id, current_user)

    if ch_in.title:
        ch.title = ch_in.title.strip()
    if ch_in.order is not None and ch_in.order != ch.order:
        old_order = ch.order
        new_order = max(1, ch_in.order)
        p_filter = (Chapter.parent_id == ch.parent_id) if ch.parent_id else Chapter.parent_id.is_(None)
        if new_order < old_order:
            await db.execute(
                update(Chapter)
                .where(Chapter.series_id == ch.series_id, p_filter, Chapter.order >= new_order, Chapter.order < old_order)
                .values(order=Chapter.order + 1)
            )
        elif new_order > old_order:
            await db.execute(
                update(Chapter)
                .where(Chapter.series_id == ch.series_id, p_filter, Chapter.order > old_order, Chapter.order <= new_order)
                .values(order=Chapter.order - 1)
            )
        ch.order = new_order
    if ch_in.description is not None:
        ch.description = ch_in.description
    if ch_in.parent_id is not None:
        ch.parent_id = ch_in.parent_id if ch_in.parent_id != "" else None
    if ch_in.level is not None:
        ch.level = ch_in.level

    await db.commit()
    await db.refresh(ch)
    return ChapterResponse.model_validate(ch)


@router.delete("/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chapter(
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    res = await db.execute(stmt)
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    await check_series_edit_permission(db, ch.series_id, current_user)

    old_order = ch.order
    series_id = ch.series_id
    p_filter = (Chapter.parent_id == ch.parent_id) if ch.parent_id else Chapter.parent_id.is_(None)

    await db.delete(ch)
    await db.execute(
        update(Chapter)
        .where(Chapter.series_id == series_id, p_filter, Chapter.order > old_order)
        .values(order=Chapter.order - 1)
    )
    await db.commit()
    return None


# --- COMMENTS (WordPress Style & Gmail Auth) ---

@router.get("/posts/{post_id_or_slug}/comments", response_model=List[CommentResponse])
async def list_comments(post_id_or_slug: str, db: AsyncSession = Depends(get_db)):
    """Lấy danh sách bình luận đã duyệt của bài viết (bao gồm các phản hồi lồng nhau)."""
    # Tìm bài viết theo id hoặc slug
    stmt_post = select(Post.id).where((Post.id == post_id_or_slug) | (Post.slug == post_id_or_slug))
    post_res = await db.execute(stmt_post)
    post_id = post_res.scalar_one_or_none()
    if not post_id:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")

    # Chỉ lấy các bình luận gốc (parent_id is None)
    stmt = (
        select(Comment)
        .where(
            Comment.post_id == post_id,
            Comment.parent_id.is_(None),
            Comment.is_approved == True
        )
        .options(selectinload(Comment.replies))
        .order_by(desc(Comment.created_at))
    )
    res = await db.execute(stmt)
    comments = res.scalars().all()
    return [CommentResponse.model_validate(c) for c in comments]


@router.post("/posts/{post_id_or_slug}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id_or_slug: str,
    comment_in: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    optional_user: Optional[User] = Depends(get_optional_user)
):
    """Đăng bình luận vào bài viết. Hỗ trợ người dùng đăng nhập Gmail hoặc khách (vãng lai)."""
    stmt_post = select(Post).where((Post.id == post_id_or_slug) | (Post.slug == post_id_or_slug))
    post_res = await db.execute(stmt_post)
    post = post_res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")

    content = comment_in.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Nội dung bình luận không được để trống")

    if optional_user:
        author_name = optional_user.full_name or optional_user.username
        author_email = optional_user.email
        author_avatar = optional_user.avatar_url
        user_id = optional_user.id
    else:
        author_name = (comment_in.author_name or "").strip() or "Độc giả ẩn danh"
        author_email = (comment_in.author_email or "").strip() or None
        author_avatar = None
        user_id = None

    # Nếu là phản hồi cho 1 bình luận khác
    parent_comment = None
    if comment_in.parent_id:
        p_stmt = select(Comment).where(Comment.id == comment_in.parent_id, Comment.post_id == post.id)
        p_res = await db.execute(p_stmt)
        parent_comment = p_res.scalar_one_or_none()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Bình luận cha không tồn tại")

    new_comment = Comment(
        post_id=post.id,
        user_id=user_id,
        author_name=author_name,
        author_email=author_email,
        author_avatar=author_avatar,
        content=content,
        parent_id=comment_in.parent_id,
        is_approved=True
    )
    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)

    # ── 1. Gửi thông báo khi bài viết có bình luận mới ──
    try:
        # Lấy tên tác giả bài viết
        post_author_stmt = select(User).where(User.id == post.author_id)
        post_author = (await db.execute(post_author_stmt)).scalar_one_or_none()
        post_author_name = (post_author.full_name or post_author.username) if post_author else "Tác giả"

        # Nếu người bình luận khác tác giả bài viết -> thông báo cho tác giả
        if post.author_id and post.author_id != user_id:
            db.add(Notification(
                user_id=post.author_id,
                actor_id=user_id,
                type="new_comment",
                target_id=post.slug,
                target_type="post",
                message=f"{author_name} đã bình luận bài viết của bạn: \"{post.title}\""
            ))

        # Nếu là phản hồi (reply) và người cha khác người reply và khác tác giả bài viết -> thông báo cho người cha
        if parent_comment and parent_comment.user_id and parent_comment.user_id != user_id and parent_comment.user_id != post.author_id:
            db.add(Notification(
                user_id=parent_comment.user_id,
                actor_id=user_id,
                type="new_comment_reply",
                target_id=post.slug,
                target_type="post",
                message=f"{author_name} đã phản hồi bình luận của bạn trong bài viết: \"{post.title}\""
            ))

        await db.commit()
    except Exception as notif_err:
        pass

    # ── 2. Ghi Audit Log phục vụ điều tra an ninh (ai bình luận bài của ai) ──
    try:
        await record_audit_log(
            db=db,
            action="COMMENT_CREATE",
            summary=f"{author_name} đã bình luận vào bài viết '{post.title}' của tác giả {post_author_name}",
            user=optional_user,
            actor_name=author_name,
            actor_email=author_email,
            target_type="post",
            target_id=post.slug,
            target_title=post.title,
            details={
                "comment_id": new_comment.id,
                "content": content[:500],
                "is_reply": bool(comment_in.parent_id),
                "parent_comment_id": comment_in.parent_id,
                "post_id": post.id,
                "post_author_id": post.author_id,
                "post_author_name": post_author_name,
            },
            request=request,
        )
    except Exception:
        pass

    # Load lại kèm replies rỗng
    return CommentResponse(
        id=new_comment.id,
        post_id=new_comment.post_id,
        user_id=new_comment.user_id,
        author_name=new_comment.author_name,
        author_avatar=new_comment.author_avatar,
        content=new_comment.content,
        parent_id=new_comment.parent_id,
        created_at=new_comment.created_at,
        replies=[]
    )


@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: str,
    comment_in: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chỉnh sửa nội dung bình luận (Chỉ tác giả hoặc Admin)."""
    stmt = select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.replies))
    res = await db.execute(stmt)
    comment = res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Bình luận không tồn tại")

    if not current_user.is_admin and comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn chỉ có quyền chỉnh sửa bình luận của chính mình")

    content = comment_in.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Nội dung bình luận không được để trống")

    comment.content = content
    await db.commit()

    stmt = select(Comment).where(Comment.id == comment.id).options(selectinload(Comment.replies))
    res = await db.execute(stmt)
    refreshed_comment = res.scalar_one()
    return CommentResponse.model_validate(refreshed_comment)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa bình luận / Thu hồi (Dành cho Admin hoặc chính người đã viết bình luận)."""
    stmt = select(Comment).where(Comment.id == comment_id)
    res = await db.execute(stmt)
    comment = res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Bình luận không tồn tại")

    if not current_user.is_admin and comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xóa bình luận này")

    comment_content = comment.content
    comment_post_id = comment.post_id

    await db.delete(comment)
    await db.commit()

    # Ghi audit log thu hồi bình luận
    try:
        await record_audit_log(
            db=db,
            action="COMMENT_DELETE",
            summary=f"{current_user.full_name or current_user.username} đã thu hồi bình luận: '{comment_content[:60]}...'",
            user=current_user,
            target_type="comment",
            target_id=comment_id,
            details={"content": comment_content, "post_id": comment_post_id},
            request=request,
        )
    except Exception:
        pass

    return None


# ══════════════════════════════════════════════════════════════
# SERIES COLLABORATION
# ══════════════════════════════════════════════════════════════

from pydantic import BaseModel as PydanticBase

class CollaboratorResponse(PydanticBase):
    id: str
    user_id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    message: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class CollabRequestCreate(PydanticBase):
    message: Optional[str] = None

class CollabStatusUpdate(PydanticBase):
    status: str  # accepted | rejected

class AddCollaboratorDirect(PydanticBase):
    user_id: str


@router.post("/series/{series_id}/request-collaboration", status_code=201)
async def request_collaboration(
    series_id: str,
    body: CollabRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Người dùng gửi yêu cầu cộng tác vào khoá học."""
    stmt = select(Series).where(Series.id == series_id)
    res = await db.execute(stmt)
    series = res.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Khoá học không tồn tại")

    if series.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Bạn đã là chủ khoá học này")

    # Check existing request
    existing_stmt = select(SeriesCollaborator).where(
        SeriesCollaborator.series_id == series_id,
        SeriesCollaborator.user_id == current_user.id
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        if existing.status == "pending":
            raise HTTPException(status_code=400, detail="Bạn đã gửi yêu cầu cộng tác trước đó")
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Bạn đã là cộng tác viên")
        # rejected - allow reapply
        existing.status = "pending"
        existing.message = body.message
    else:
        collab = SeriesCollaborator(
            series_id=series_id,
            user_id=current_user.id,
            status="pending",
            message=body.message,
        )
        db.add(collab)

    actor_name = current_user.full_name or current_user.username

    # Notify series owner
    if series.owner_id:
        notif = Notification(
            user_id=series.owner_id,
            actor_id=current_user.id,
            type="collab_request",
            target_id=series_id,
            target_type="series",
            message=f"{actor_name} muốn cộng tác khoá học '{series.title}'",
        )
        db.add(notif)

    # Also notify admins if owner is not admin or if series has no owner
    admin_users = (await db.execute(select(User).where((User.is_admin == True) | (User.role == "admin")))).scalars().all()
    for adm in admin_users:
        if adm.id != current_user.id and adm.id != series.owner_id:
            db.add(Notification(
                user_id=adm.id,
                actor_id=current_user.id,
                type="collab_request",
                target_id=series_id,
                target_type="series",
                message=f"[Quản trị] {actor_name} gửi yêu cầu cộng tác khoá học '{series.title}'",
            ))

    await db.commit()
    return {"ok": True, "message": "Yêu cầu đã được gửi"}


@router.get("/series/{series_id}/collaborators", response_model=List[CollaboratorResponse])
async def get_collaborators(
    series_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách cộng tác viên (chỉ owner hoặc admin)."""
    stmt = select(Series).where(Series.id == series_id)
    series = (await db.execute(stmt)).scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Khoá học không tồn tại")

    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    is_owner = series.owner_id == current_user.id

    if is_admin or is_owner:
        collabs_stmt = select(SeriesCollaborator).where(SeriesCollaborator.series_id == series_id)
    else:
        collabs_stmt = select(SeriesCollaborator).where(
            SeriesCollaborator.series_id == series_id,
            or_(
                SeriesCollaborator.status == "accepted",
                SeriesCollaborator.user_id == current_user.id
            )
        )

    collabs = (await db.execute(collabs_stmt)).scalars().all()

    result = []
    for c in collabs:
        user = await db.get(User, c.user_id)
        if user:
            result.append(CollaboratorResponse(
                id=c.id,
                user_id=c.user_id,
                username=user.username,
                full_name=user.full_name,
                avatar_url=user.avatar_url,
                status=c.status,
                message=c.message if (is_admin or is_owner or c.user_id == current_user.id) else None,
                created_at=c.created_at,
            ))
    return result


@router.post("/series/{series_id}/collaborators", status_code=201)
async def add_collaborator_direct(
    series_id: str,
    body: AddCollaboratorDirect,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin hoặc chủ khoá học trực tiếp thêm cộng tác viên."""
    series = (await db.execute(select(Series).where(Series.id == series_id))).scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Khoá học không tồn tại")

    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    is_owner = series.owner_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Chỉ chủ khoá học hoặc Quản trị viên mới thực hiện được")

    target_user = await db.get(User, body.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng này")

    existing = (await db.execute(
        select(SeriesCollaborator).where(
            SeriesCollaborator.series_id == series_id,
            SeriesCollaborator.user_id == body.user_id
        )
    )).scalar_one_or_none()

    if existing:
        existing.status = "accepted"
    else:
        collab = SeriesCollaborator(
            series_id=series_id,
            user_id=body.user_id,
            status="accepted",
            message="Được thêm trực tiếp bởi quản trị viên / tác giả",
        )
        db.add(collab)

    notif = Notification(
        user_id=body.user_id,
        actor_id=current_user.id,
        type="collab_accepted",
        target_id=series_id,
        target_type="series",
        message=f"Bạn đã được cấp quyền cộng tác viên cho khoá học '{series.title}'!",
    )
    db.add(notif)
    await db.commit()

    return {"ok": True, "message": "Đã thêm cộng tác viên thành công"}


@router.put("/series/{series_id}/collaborators/{user_id}")
async def update_collaborator(
    series_id: str,
    user_id: str,
    body: CollabStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Chấp nhận / Từ chối yêu cầu cộng tác."""
    if body.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="Status phải là accepted hoặc rejected")

    series = (await db.execute(select(Series).where(Series.id == series_id))).scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Khoá học không tồn tại")

    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    is_owner = series.owner_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Chỉ chủ khoá học hoặc Quản trị viên mới thực hiện được")

    collab = (await db.execute(
        select(SeriesCollaborator).where(
            SeriesCollaborator.series_id == series_id,
            SeriesCollaborator.user_id == user_id
        )
    )).scalar_one_or_none()
    if not collab:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")

    collab.status = body.status
    await db.commit()

    # Notify the requester
    notif_type = "collab_accepted" if body.status == "accepted" else "collab_rejected"
    msg = (
        f"Yêu cầu cộng tác khoá học '{series.title}' đã được chấp nhận!"
        if body.status == "accepted"
        else f"Yêu cầu cộng tác khoá học '{series.title}' bị từ chối."
    )
    notif = Notification(
        user_id=user_id,
        actor_id=current_user.id,
        type=notif_type,
        target_id=series_id,
        target_type="series",
        message=msg,
    )
    db.add(notif)
    await db.commit()

    return {"ok": True, "status": body.status}


@router.delete("/series/{series_id}/collaborators/{user_id}", status_code=204)
async def remove_collaborator(
    series_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    series = (await db.execute(select(Series).where(Series.id == series_id))).scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404)
    is_admin = current_user.is_admin or getattr(current_user, "role", "") == "admin"
    is_owner = series.owner_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403)
    collab = (await db.execute(
        select(SeriesCollaborator).where(
            SeriesCollaborator.series_id == series_id,
            SeriesCollaborator.user_id == user_id
        )
    )).scalar_one_or_none()
    if collab:
        await db.delete(collab)
        await db.commit()
    return None


# ══════════════════════════════════════════════════════════════
# POST LIKES
# ══════════════════════════════════════════════════════════════

class LikeStatusResponse(PydanticBase):
    liked: bool
    likes_count: int


@router.post("/posts/{post_id}/like", response_model=LikeStatusResponse)
async def toggle_like(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = (await db.execute(select(Post).where(Post.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")

    existing = (await db.execute(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
    )).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        liked = False
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))
        liked = True

    await db.commit()
    likes_count = (await db.execute(
        select(func.count()).where(PostLike.post_id == post_id)
    )).scalar() or 0
    return LikeStatusResponse(liked=liked, likes_count=likes_count)


@router.get("/posts/{post_id}/like-status", response_model=LikeStatusResponse)
async def get_like_status(
    post_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    liked = False
    if current_user:
        liked = (await db.execute(
            select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
        )).scalar_one_or_none() is not None

    likes_count = (await db.execute(
        select(func.count()).where(PostLike.post_id == post_id)
    )).scalar() or 0
    return LikeStatusResponse(liked=liked, likes_count=likes_count)


# ══════════════════════════════════════════════════════════════
# POST REPORTS
# ══════════════════════════════════════════════════════════════

VALID_REASONS = {"spam", "inappropriate", "misinformation", "copyright", "other"}

class PostReportCreate(PydanticBase):
    reason: str
    description: Optional[str] = None

class PostReportResponse(PydanticBase):
    id: str
    post_id: str
    post_title: Optional[str] = None
    post_slug: Optional[str] = None
    reporter_id: Optional[str] = None
    reporter_username: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: str
    admin_note: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class PostReportUpdate(PydanticBase):
    status: str
    admin_note: Optional[str] = None


@router.post("/posts/{post_id}/report", status_code=201)
async def report_post(
    post_id: str,
    body: PostReportCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail=f"Lý do không hợp lệ. Chọn: {', '.join(VALID_REASONS)}")

    post = (await db.execute(select(Post).where(Post.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")

    # Prevent duplicate pending report from same user
    existing = (await db.execute(
        select(PostReport).where(
            PostReport.post_id == post_id,
            PostReport.reporter_id == current_user.id,
            PostReport.status == "pending"
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Bạn đã tố cáo bài viết này rồi")

    report = PostReport(
        post_id=post_id,
        reporter_id=current_user.id,
        reason=body.reason,
        description=body.description,
        status="pending",
    )
    db.add(report)
    await db.commit()

    # Ghi audit log tố cáo vi phạm
    try:
        await record_audit_log(
            db=db,
            action="POST_REPORT",
            summary=f"{current_user.full_name or current_user.username} đã tố cáo bài viết '{post.title}' (Lý do: {body.reason})",
            user=current_user,
            target_type="post",
            target_id=post.slug,
            target_title=post.title,
            details={
                "post_id": post.id,
                "reason": body.reason,
                "description": body.description,
                "author_id": post.author_id,
            },
            request=request,
        )
    except Exception:
        pass

    return {"ok": True, "message": "Tố cáo đã được gửi. Chúng tôi sẽ xật lý sớm nhất có thể."}


@router.get("/admin/reports", response_model=List[PostReportResponse])
async def list_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = 50,
    offset: int = 0,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PostReport)
    if status_filter:
        stmt = stmt.where(PostReport.status == status_filter)
    stmt = stmt.order_by(PostReport.created_at.desc()).limit(limit).offset(offset)
    reports = (await db.execute(stmt)).scalars().all()

    result = []
    for r in reports:
        post = await db.get(Post, r.post_id)
        reporter = await db.get(User, r.reporter_id) if r.reporter_id else None
        result.append(PostReportResponse(
            id=r.id,
            post_id=r.post_id,
            post_title=post.title if post else None,
            post_slug=post.slug if post else None,
            reporter_id=r.reporter_id,
            reporter_username=reporter.username if reporter else None,
            reason=r.reason,
            description=r.description,
            status=r.status,
            admin_note=r.admin_note,
            created_at=r.created_at,
        ))
    return result


@router.put("/admin/reports/{report_id}", response_model=PostReportResponse)
async def update_report(
    report_id: str,
    body: PostReportUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    valid_statuses = {"pending", "reviewed", "dismissed", "action_taken"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Status không hợp lệ")

    report = await db.get(PostReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo")

    report.status = body.status
    report.admin_note = body.admin_note
    await db.commit()

    post = await db.get(Post, report.post_id)
    reporter = await db.get(User, report.reporter_id) if report.reporter_id else None
    return PostReportResponse(
        id=report.id,
        post_id=report.post_id,
        post_title=post.title if post else None,
        post_slug=post.slug if post else None,
        reporter_id=report.reporter_id,
        reporter_username=reporter.username if reporter else None,
        reason=report.reason,
        description=report.description,
        status=report.status,
        admin_note=report.admin_note,
        created_at=report.created_at,
    )
