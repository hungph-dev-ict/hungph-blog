import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.orm import relationship

from app.core.database import Base

# Association table for KnowledgeBase <-> Post (Many-to-Many)
kb_posts = Table(
    "kb_posts",
    Base.metadata,
    Column("kb_id", String(36), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), primary_key=True),
    Column("post_id", String(36), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
)

# Association table for KnowledgeBase <-> Series (Many-to-Many)
kb_series = Table(
    "kb_series",
    Base.metadata,
    Column("kb_id", String(36), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), primary_key=True),
    Column("series_id", String(36), ForeignKey("series.id", ondelete="CASCADE"), primary_key=True),
)


class KnowledgeBase(Base):
    """Mô hình Kho Tri Thức (Knowledge Base) phục vụ RAG đa miền."""
    __tablename__ = "knowledge_bases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    slug = Column(String(280), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    posts = relationship("Post", secondary=kb_posts, lazy="selectin")
    series = relationship("Series", secondary=kb_series, lazy="selectin")
