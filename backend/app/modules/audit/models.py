import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from app.core.database import Base


class AuditLog(Base):
    """Lưu vết nhật ký hoạt động hệ thống & access log phục vụ điều tra an ninh."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_name = Column(String(100), nullable=True)   # Tên người thực hiện (User hoặc Khách vãng lai)
    actor_email = Column(String(100), nullable=True)  # Email người thực hiện

    action = Column(String(50), nullable=False, index=True)
    # Các hành động chính:
    # POST_CREATE, POST_UPDATE, POST_DELETE, POST_PUBLISH, POST_UNPUBLISH, POST_VIEW
    # COMMENT_CREATE, COMMENT_DELETE
    # POST_REPORT
    # USER_LOGIN, USER_LOGOUT, USER_REGISTER, USER_UPDATE_PROFILE

    target_type = Column(String(30), nullable=True, index=True)  # post | comment | series | user | auth
    target_id = Column(String(100), nullable=True)               # ID hoặc slug bài viết / đối tượng
    target_title = Column(String(255), nullable=True)            # Tiêu đề bài viết hoặc tên đối tượng liên quan

    summary = Column(String(500), nullable=False)                # Tóm tắt hành động tiếng Việt rõ ràng
    details = Column(Text, nullable=True)                        # Dữ liệu JSON chi tiết (nội dung bình luận, lý do, headers...)

    ip_address = Column(String(45), nullable=True, index=True)   # Địa chỉ IP truy cập
    user_agent = Column(String(300), nullable=True)              # Trình duyệt / thiết bị
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
