import json
import logging
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request
from app.modules.auth.models import User
from app.modules.audit.models import AuditLog

logger = logging.getLogger(__name__)


def get_client_ip(request: Optional[Request] = None) -> Optional[str]:
    """Trích xuất IP client thực tế từ request kể cả khi qua Reverse Proxy/CDN."""
    if not request:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    return request.client.host if request.client else None


def get_user_agent(request: Optional[Request] = None) -> Optional[str]:
    """Trích xuất User Agent của thiết bị."""
    if not request:
        return None
    return request.headers.get("user-agent", "")[:300]


async def record_audit_log(
    db: AsyncSession,
    action: str,
    summary: str,
    user: Optional[User] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    target_title: Optional[str] = None,
    details: Optional[Any] = None,
    request: Optional[Request] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[AuditLog]:
    """Hàm tiện ích ghi lại log kiểm tra / điều tra bảo mật và hoạt động hệ thống."""
    try:
        user_id = user.id if user else None
        if not actor_name and user:
            actor_name = user.full_name or user.username
        if not actor_email and user:
            actor_email = user.email

        if not ip_address and request:
            ip_address = get_client_ip(request)
        if not user_agent and request:
            user_agent = get_user_agent(request)

        details_str = None
        if details is not None:
            if isinstance(details, (dict, list)):
                details_str = json.dumps(details, ensure_ascii=False)
            else:
                details_str = str(details)

        log_entry = AuditLog(
            user_id=user_id,
            actor_name=str(actor_name)[:100] if actor_name else None,
            actor_email=str(actor_email)[:100] if actor_email else None,
            action=str(action)[:50],
            target_type=str(target_type)[:30] if target_type else None,
            target_id=str(target_id)[:255] if target_id else None,
            target_title=str(target_title)[:255] if target_title else None,
            summary=str(summary)[:1000] if summary else "",
            details=details_str,
            ip_address=str(ip_address)[:45] if ip_address else None,
            user_agent=str(user_agent)[:300] if user_agent else None,
        )
        db.add(log_entry)
        await db.commit()
        return log_entry
    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        logger.error(f"Lỗi khi ghi audit log ({action}): {e}", exc_info=True)
        return None
