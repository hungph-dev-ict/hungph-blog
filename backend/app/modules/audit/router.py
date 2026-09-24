from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.audit.models import AuditLog

router = APIRouter(prefix="/admin/audit-logs", tags=["Admin Audit Logs"])


class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    target_title: Optional[str] = None
    summary: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AuditLogResponse]


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ quản trị viên mới có quyền xem nhật ký kiểm tra hệ thống"
        )
    return current_user


@router.get("", response_model=AuditLogListResponse)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách nhật ký kiểm tra & access log phục vụ điều tra (dành cho Admin)."""
    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)
    if target_type:
        query = query.where(AuditLog.target_type == target_type)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                AuditLog.summary.ilike(term),
                AuditLog.actor_name.ilike(term),
                AuditLog.actor_email.ilike(term),
                AuditLog.ip_address.ilike(term),
                AuditLog.target_title.ilike(term),
                AuditLog.action.ilike(term),
            )
        )

    # Đếm tổng
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    # Lấy dữ liệu phân trang
    offset = (page - 1) * limit
    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    res = await db.execute(query)
    items = res.scalars().all()

    return AuditLogListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items,
    )


@router.get("/stats")
async def get_audit_stats(
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy thống kê nhanh về các hoạt động gần đây."""
    today = datetime.now().date()
    
    # Tổng log hôm nay
    today_stmt = select(func.count(AuditLog.id)).where(func.date(AuditLog.created_at) == today)
    today_count = (await db.execute(today_stmt)).scalar() or 0

    # Tổng bài viết tạo mới
    posts_stmt = select(func.count(AuditLog.id)).where(AuditLog.action == "POST_CREATE")
    posts_count = (await db.execute(posts_stmt)).scalar() or 0

    # Tổng bình luận
    comments_stmt = select(func.count(AuditLog.id)).where(AuditLog.action == "COMMENT_CREATE")
    comments_count = (await db.execute(comments_stmt)).scalar() or 0

    # Tổng tố cáo
    reports_stmt = select(func.count(AuditLog.id)).where(AuditLog.action == "POST_REPORT")
    reports_count = (await db.execute(reports_stmt)).scalar() or 0

    return {
        "today_activities": today_count,
        "total_posts_created": posts_count,
        "total_comments": comments_count,
        "total_reports": reports_count,
    }
