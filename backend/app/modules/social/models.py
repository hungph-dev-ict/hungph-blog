import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from app.core.database import Base


class Follow(Base):
    """Theo dõi người dùng."""
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_follow"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    follower_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    following_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Notification(Base):
    """Thông báo hệ thống."""
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Người nhận thông báo
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Người tạo ra sự kiện (follow, request, etc.)
    actor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # Loại thông báo
    # collab_request | collab_accepted | collab_rejected | new_follower | new_post
    type = Column(String(50), nullable=False)
    # ID hoặc slug đối tượng liên quan (series_id, post_slug, ...)
    target_id = Column(String(255), nullable=True)
    target_type = Column(String(30), nullable=True)  # "series" | "post"
    # Nội dung thông báo
    message = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
