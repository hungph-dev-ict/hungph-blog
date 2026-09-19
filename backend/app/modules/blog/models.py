import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from app.core.database import Base

# Association table for Post <-> Tag (Many-to-Many)
post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", String(36), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    posts = relationship("Post", back_populates="category")
    series = relationship("Series", back_populates="category")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(120), unique=True, index=True, nullable=False)

    posts = relationship("Post", secondary=post_tags, back_populates="tags")


class Series(Base):
    """Mô hình Khóa học / Tuyển tập / Bộ truyện (Series/Course)."""
    __tablename__ = "series"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    slug = Column(String(280), unique=True, index=True, nullable=False)
    summary = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=True)
    is_published = Column(Boolean, default=True)
    
    category_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    category = relationship("Category", back_populates="series", lazy="selectin")

    chapters = relationship("Chapter", back_populates="series", cascade="all, delete-orphan", order_by="Chapter.order", lazy="selectin")
    posts = relationship("Post", back_populates="series", lazy="selectin")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Chapter(Base):
    """Mô hình Chương trong Khóa học / Bộ truyện."""
    __tablename__ = "chapters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    series_id = Column(String(36), ForeignKey("series.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    order = Column(Integer, default=1)
    description = Column(Text, nullable=True)

    series = relationship("Series", back_populates="chapters")
    posts = relationship("Post", back_populates="chapter", order_by="Post.order_in_chapter", lazy="selectin")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Post(Base):
    __tablename__ = "posts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    slug = Column(String(280), unique=True, index=True, nullable=False)
    summary = Column(Text, nullable=True)
    content_html = Column(Text, nullable=False, default="")
    content_markdown = Column(Text, nullable=True, default="")
    cover_image = Column(String(500), nullable=True)
    
    is_published = Column(Boolean, default=False, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    reading_time_minutes = Column(Integer, default=1)
    views_count = Column(Integer, default=0)

    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)

    # Series & Chapter membership (cho bài viết kiểu Course/Truyện)
    series_id = Column(String(36), ForeignKey("series.id", ondelete="SET NULL"), nullable=True)
    chapter_id = Column(String(36), ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    order_in_chapter = Column(Integer, default=1)

    category = relationship("Category", back_populates="posts", lazy="selectin")
    tags = relationship("Tag", secondary=post_tags, back_populates="posts", lazy="selectin")
    author = relationship("app.modules.auth.models.User", lazy="selectin")
    series = relationship("Series", back_populates="posts", lazy="selectin")
    chapter = relationship("Chapter", back_populates="posts", lazy="selectin")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan", order_by="Comment.created_at.desc()", lazy="selectin")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Comment(Base):
    """Mô hình Bình luận bài viết kiểu WordPress, hỗ trợ người dùng Gmail & khách."""
    __tablename__ = "comments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String(36), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    author_name = Column(String(100), nullable=False)
    author_email = Column(String(255), nullable=True)
    author_avatar = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)

    parent_id = Column(String(36), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    is_approved = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("app.modules.auth.models.User", lazy="selectin")
    post = relationship("Post", back_populates="comments")
    replies = relationship("Comment", cascade="all, delete-orphan", order_by="Comment.created_at.asc()", lazy="selectin")
