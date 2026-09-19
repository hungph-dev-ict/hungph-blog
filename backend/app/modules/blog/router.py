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
from app.modules.blog.models import Category, Chapter, Comment, Post, PostLike, PostReport, Series, SeriesCollaborator, Tag, post_tags
from app.modules.social.models import Follow, Notification
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if post_in.series_id:
        await check_series_write_permission(db, post_in.series_id, current_user)

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

    if new_post.is_published:
        await notify_followers_new_post(db, new_post, current_user)

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

    if post_in.series_id is not None and post_in.series_id != "" and post_in.series_id != post.series_id:
        await check_series_write_permission(db, post_in.series_id, current_user)

    was_published = post.is_published

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

    if post.is_published and not was_published:
        await notify_followers_new_post(db, post, current_user)

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
        owner_id=admin.id,
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
    current_user: User = Depends(get_current_user)
):
    s = await check_series_edit_permission(db, series_id, current_user)

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
    await check_series_edit_permission(db, series_id, current_user)

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
    current_user: User = Depends(get_current_user)
):
    stmt = select(Chapter).where(Chapter.id == chapter_id)
    res = await db.execute(stmt)
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    await check_series_edit_permission(db, ch.series_id, current_user)

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

    await db.commit()

    # Notify series owner
    if series.owner_id:
        actor_name = current_user.full_name or current_user.username
        notif = Notification(
            user_id=series.owner_id,
            actor_id=current_user.id,
            type="collab_request",
            target_id=series_id,
            target_type="series",
            message=f"{actor_name} muốn cộng tác khoá học '{series.title}'",
        )
        db.add(notif)
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

    is_owner = series.owner_id == current_user.id
    if not current_user.is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Chỉ chủ khoá học mới xem được")

    collabs_stmt = select(SeriesCollaborator).where(SeriesCollaborator.series_id == series_id)
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
                message=c.message,
                created_at=c.created_at,
            ))
    return result


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

    is_owner = series.owner_id == current_user.id
    if not current_user.is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Chỉ chủ khoá học mới thực hiện được")

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
    is_owner = series.owner_id == current_user.id
    if not current_user.is_admin and not is_owner:
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
        reporter_id=report.reporter_id,
        reporter_username=reporter.username if reporter else None,
        reason=report.reason,
        description=report.description,
        status=report.status,
        admin_note=report.admin_note,
        created_at=report.created_at,
    )
