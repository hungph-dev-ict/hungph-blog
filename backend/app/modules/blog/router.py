import math
import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from slugify import slugify
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.modules.auth.deps import get_current_admin, get_current_user, get_optional_user
from app.modules.auth.models import User
from app.modules.blog.models import Category, Chapter, Comment, Post, Series, Tag, post_tags
from app.modules.blog.schemas import (
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


def calculate_reading_time(text: str) -> int:
    clean_text = re.sub(r"<[^>]+>", " ", text or "")
    words = clean_text.split()
    return max(1, math.ceil(len(words) / 200))


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
    limit: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    series_id: Optional[str] = None,
    include_drafts: bool = False,
    db: AsyncSession = Depends(get_db)
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
        )
    )

    if not include_drafts:
        stmt = stmt.where(Post.is_published == True)

    if category:
        stmt = stmt.join(Post.category).where(Category.slug == category)

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
    if not include_drafts:
        count_stmt = count_stmt.where(Post.is_published == True)
    if category:
        count_stmt = count_stmt.join(Post.category).where(Category.slug == category)
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
            
            for ch in sorted(series_obj.chapters, key=lambda c: c.order):
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

    return PostDetail.model_validate(post)


# --- POSTS CRUD (Member: Own posts | Admin: All posts) ---

@router.post("/posts", response_model=PostDetail, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_in: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    slug = await make_unique_slug(db, post_in.slug or post_in.title, model_cls=Post)
    reading_time = calculate_reading_time(post_in.content_html or post_in.content_markdown or "")
    tags = await get_or_create_tags(db, post_in.tags) if post_in.tags else []

    now = datetime.now(timezone.utc)
    published_at = now if post_in.is_published else None

    new_post = Post(
        title=post_in.title.strip(),
        slug=slug,
        summary=post_in.summary.strip() if post_in.summary else None,
        content_html=post_in.content_html,
        content_markdown=post_in.content_markdown,
        cover_image=post_in.cover_image,
        is_published=post_in.is_published,
        published_at=published_at,
        reading_time_minutes=reading_time,
        author_id=current_user.id,
        category_id=post_in.category_id if post_in.category_id != "" else None,
        series_id=post_in.series_id if post_in.series_id != "" else None,
        chapter_id=post_in.chapter_id if post_in.chapter_id != "" else None,
        order_in_chapter=post_in.order_in_chapter or 1,
        tags=tags
    )
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

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

    if post_in.title is not None:
        post.title = post_in.title.strip()
    if post_in.slug is not None:
        post.slug = await make_unique_slug(db, post_in.slug, model_cls=Post, current_id=post.id)
    if post_in.summary is not None:
        post.summary = post_in.summary.strip() if post_in.summary else None
    if post_in.content_html is not None:
        post.content_html = post_in.content_html
        post.reading_time_minutes = calculate_reading_time(post.content_html)
    if post_in.content_markdown is not None:
        post.content_markdown = post_in.content_markdown
    if post_in.cover_image is not None:
        post.cover_image = post_in.cover_image
    if post_in.category_id is not None:
        post.category_id = post_in.category_id if post_in.category_id != "" else None
    if post_in.series_id is not None:
        post.series_id = post_in.series_id if post_in.series_id != "" else None
    if post_in.chapter_id is not None:
        post.chapter_id = post_in.chapter_id if post_in.chapter_id != "" else None
    if post_in.order_in_chapter is not None:
        post.order_in_chapter = post_in.order_in_chapter

    if post_in.is_published is not None:
        if post_in.is_published and not post.is_published and not post.published_at:
            post.published_at = datetime.now(timezone.utc)
        post.is_published = post_in.is_published

    if post_in.tags is not None:
        post.tags = await get_or_create_tags(db, post_in.tags)

    await db.commit()
    await db.refresh(post)
    return PostDetail.model_validate(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
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

    await db.delete(post)
    await db.commit()
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
        s_resp = SeriesResponse(
            id=s.id,
            title=s.title,
            slug=s.slug,
            summary=s.summary,
            cover_image=s.cover_image,
            is_published=s.is_published,
            category_id=s.category_id,
            created_at=s.created_at,
            category=CategoryResponse.model_validate(s.category) if s.category else None,
            total_chapters=tot_chapters,
            total_lessons=tot_lessons
        )
        output.append(s_resp)
    return output


@router.get("/series/{slug}", response_model=SeriesDetailResponse)
async def get_series_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Series)
        .where(Series.slug == slug)
        .options(
            selectinload(Series.category),
            selectinload(Series.chapters).selectinload(Chapter.posts),
        )
    )
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Khóa học không tồn tại")

    chapters_data = []
    total_lessons = 0
    for ch in sorted(s.chapters, key=lambda c: c.order):
        posts = sorted(ch.posts, key=lambda p: p.order_in_chapter or 1)
        total_lessons += len(posts)
        chapters_data.append(
            ChapterWithLessons(
                id=ch.id,
                series_id=ch.series_id,
                title=ch.title,
                order=ch.order,
                description=ch.description,
                created_at=ch.created_at,
                lessons=[LessonBrief.model_validate(p) for p in posts]
            )
        )

    return SeriesDetailResponse(
        id=s.id,
        title=s.title,
        slug=s.slug,
        summary=s.summary,
        cover_image=s.cover_image,
        is_published=s.is_published,
        category_id=s.category_id,
        created_at=s.created_at,
        category=CategoryResponse.model_validate(s.category) if s.category else None,
        total_chapters=len(chapters_data),
        total_lessons=total_lessons,
        chapters=chapters_data
    )


@router.post("/series", response_model=SeriesResponse, status_code=status.HTTP_201_CREATED)
async def create_series(
    series_in: SeriesCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    slug = await make_unique_slug(db, series_in.slug or series_in.title, model_cls=Series)
    new_series = Series(
        title=series_in.title.strip(),
        slug=slug,
        summary=series_in.summary,
        cover_image=series_in.cover_image,
        is_published=series_in.is_published,
        category_id=series_in.category_id if series_in.category_id != "" else None
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
        created_at=new_series.created_at,
        total_chapters=0,
        total_lessons=0
    )


@router.put("/series/{series_id}", response_model=SeriesResponse)
async def update_series(
    series_id: str,
    series_in: SeriesUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(Series).where(Series.id == series_id).options(selectinload(Series.chapters), selectinload(Series.category))
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")

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

    await db.commit()
    await db.refresh(s)
    return SeriesResponse(
        id=s.id,
        title=s.title,
        slug=s.slug,
        summary=s.summary,
        cover_image=s.cover_image,
        is_published=s.is_published,
        category_id=s.category_id,
        created_at=s.created_at,
        category=CategoryResponse.model_validate(s.category) if s.category else None,
        total_chapters=len(s.chapters),
        total_lessons=0
    )


@router.delete("/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_series(
    series_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(Series).where(Series.id == series_id)
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")
    await db.delete(s)
    await db.commit()
    return None


# --- CHAPTERS CRUD ---

@router.post("/series/{series_id}/chapters", response_model=ChapterResponse)
async def add_chapter_to_series(
    series_id: str,
    chapter_in: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(Series).where(Series.id == series_id)
    res = await db.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Series not found")

    ch = Chapter(
        series_id=series_id,
        title=chapter_in.title.strip(),
        order=chapter_in.order,
        description=chapter_in.description
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
    admin: User = Depends(get_current_admin)
):
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    res = await db.execute(stmt)
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    if ch_in.title:
        ch.title = ch_in.title.strip()
    if ch_in.order is not None:
        ch.order = ch_in.order
    if ch_in.description is not None:
        ch.description = ch_in.description

    await db.commit()
    await db.refresh(ch)
    return ChapterResponse.model_validate(ch)


@router.delete("/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chapter(
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    res = await db.execute(stmt)
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    await db.delete(ch)
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
    if comment_in.parent_id:
        p_stmt = select(Comment).where(Comment.id == comment_in.parent_id, Comment.post_id == post.id)
        p_res = await db.execute(p_stmt)
        if not p_res.scalar_one_or_none():
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

    # Load lại kèm replies rỗng
    return CommentResponse(
        id=new_comment.id,
        post_id=new_comment.post_id,
        author_name=new_comment.author_name,
        author_avatar=new_comment.author_avatar,
        content=new_comment.content,
        parent_id=new_comment.parent_id,
        created_at=new_comment.created_at,
        replies=[]
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa bình luận (Dành cho Admin hoặc chính người đã viết bình luận)."""
    stmt = select(Comment).where(Comment.id == comment_id)
    res = await db.execute(stmt)
    comment = res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Bình luận không tồn tại")

    if not current_user.is_admin and comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xóa bình luận này")

    await db.delete(comment)
    await db.commit()
    return None

