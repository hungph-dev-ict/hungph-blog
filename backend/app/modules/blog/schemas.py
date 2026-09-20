from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel


# --- Tags ---
class TagBase(BaseModel):
    name: str
    slug: str


class TagCreate(BaseModel):
    name: str


class TagResponse(TagBase):
    id: str

    class Config:
        from_attributes = True


# --- Categories ---
class CategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: str
    created_at: datetime
    post_count: Optional[int] = 0

    class Config:
        from_attributes = True


# --- Author Brief ---
class AuthorBrief(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


# --- Course / Series & Chapters ---
class LessonBrief(BaseModel):
    id: str
    title: str
    slug: str
    reading_time_minutes: int
    is_published: bool
    order_in_chapter: int

    class Config:
        from_attributes = True


class ChapterBase(BaseModel):
    title: str
    order: int = 1
    description: Optional[str] = None
    parent_id: Optional[str] = None
    level: int = 1


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    order: Optional[int] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    level: Optional[int] = None


class ChapterResponse(ChapterBase):
    id: str
    series_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChapterWithLessons(ChapterResponse):
    lessons: List[LessonBrief] = []
    sub_chapters: List[Any] = []


class SeriesBase(BaseModel):
    title: str
    slug: Optional[str] = None
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: bool = True
    category_id: Optional[str] = None
    hierarchy_config: Optional[str] = '["Chương"]'
    attribution_text: Optional[str] = None


class SeriesCreate(SeriesBase):
    author_id: Optional[str] = None


class SeriesUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: Optional[bool] = None
    category_id: Optional[str] = None
    hierarchy_config: Optional[str] = None
    attribution_text: Optional[str] = None
    author_id: Optional[str] = None


class SeriesBrief(BaseModel):
    id: str
    title: str
    slug: str

    class Config:
        from_attributes = True


class SeriesResponse(SeriesBase):
    id: str
    slug: str
    created_at: datetime
    category: Optional[CategoryResponse] = None
    author: Optional[AuthorBrief] = None
    author_id: Optional[str] = None
    total_chapters: int = 0
    total_lessons: int = 0
    total_reading_time_minutes: int = 0

    class Config:
        from_attributes = True


class SeriesDetailResponse(SeriesResponse):
    chapters: List[ChapterWithLessons] = []


# --- Posts ---
class PostCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    summary: Optional[str] = None
    content_html: str
    content_markdown: Optional[str] = ""
    cover_image: Optional[str] = None
    is_published: bool = False
    category_id: Optional[str] = None
    tags: List[str] = []
    # Course / Series options
    series_id: Optional[str] = None
    chapter_id: Optional[str] = None
    order_in_chapter: Optional[int] = 1


class PostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    summary: Optional[str] = None
    content_html: Optional[str] = None
    content_markdown: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: Optional[bool] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    series_id: Optional[str] = None
    chapter_id: Optional[str] = None
    order_in_chapter: Optional[int] = None


class PostListItem(BaseModel):
    id: str
    title: str
    slug: str
    summary: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: bool
    published_at: Optional[datetime] = None
    reading_time_minutes: int
    views_count: int
    likes_count: int = 0
    category: Optional[CategoryResponse] = None
    tags: List[TagResponse] = []
    author: Optional[AuthorBrief] = None
    # Series fields
    series_id: Optional[str] = None
    series: Optional[SeriesBrief] = None
    chapter_id: Optional[str] = None
    order_in_chapter: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostDetail(PostListItem):
    content_html: str
    content_markdown: Optional[str] = ""
    # Navigation and Outline for Course / Series
    series_outline: Optional[SeriesDetailResponse] = None
    prev_post: Optional[LessonBrief] = None
    next_post: Optional[LessonBrief] = None


class PaginatedPosts(BaseModel):
    items: List[PostListItem]
    total: int
    page: int
    limit: int
    total_pages: int


# --- Comments (WordPress style & Gmail Auth) ---
class CommentCreate(BaseModel):
    content: str
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    parent_id: Optional[str] = None


class CommentUpdate(BaseModel):
    content: str


class CommentReplyResponse(BaseModel):
    id: str
    post_id: str
    user_id: Optional[str] = None
    author_name: str
    author_avatar: Optional[str] = None
    content: str
    parent_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: Optional[str] = None
    author_name: str
    author_avatar: Optional[str] = None
    content: str
    parent_id: Optional[str] = None
    created_at: datetime
    replies: List[CommentReplyResponse] = []

    class Config:
        from_attributes = True
