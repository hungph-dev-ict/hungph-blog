import json
import logging
from typing import Any, Dict, List
from urllib.parse import parse_qs
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.modules.audit.service import record_audit_log, get_client_ip, get_user_agent

logger = logging.getLogger(__name__)

SENSITIVE_FIELD_NAMES = {
    "password",
    "pass",
    "confirm_password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "authorization",
    "api_key",
    "credit_card",
    "credential",
}


def sanitize_payload(data: Any) -> Any:
    """Loại bỏ thông tin nhạy cảm như mật khẩu và token khỏi payload lưu trữ."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(term in k_lower for term in SENSITIVE_FIELD_NAMES):
                sanitized[k] = "***"
            elif isinstance(v, (dict, list)):
                sanitized[k] = sanitize_payload(v)
            else:
                sanitized[k] = v
        return sanitized
    elif isinstance(data, list):
        return [sanitize_payload(item) for item in data]
    return data


class AuditLogMiddleware(BaseHTTPMiddleware):
    """
    Middleware tự động ghi nhận nhật ký hệ thống (Audit Log):
    - Đảm bảo ghi lại đầy đủ payload của các request chưa đăng nhập (POST, PUT, PATCH, DELETE).
    - Ghi nhận các truy cập trái phép hoặc đăng nhập thất bại (401, 403, 400).
    - Hỗ trợ quản trị viên kiểm soát an ninh và theo dõi hành vi truy cập.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Bỏ qua các endpoint không phải API hoặc tài nguyên tĩnh / docs
        if not path.startswith("/api/"):
            return await call_next(request)

        # Tránh ghi log vòng lặp vô hạn khi admin xem hoặc tải audit logs
        if "/admin/audit-logs" in path:
            return await call_next(request)

        # 1. Kiểm tra trạng thái xác thực của người gửi
        is_authenticated = False
        user_id = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header[7:].strip()
            decoded_id = decode_token(raw_token)
            if decoded_id:
                is_authenticated = True
                user_id = decoded_id

        # 2. Đọc payload của request nếu có (POST, PUT, PATCH, DELETE)
        has_payload = request.method in ("POST", "PUT", "PATCH", "DELETE")
        payload_data = None

        if has_payload:
            content_type = request.headers.get("content-type", "")
            if "multipart/form-data" in content_type:
                payload_data = {"_note": "Tệp tin tải lên (Multipart Form Upload)"}
            else:
                try:
                    body_bytes = await request.body()
                    # Reconstruct receive để các route handler phía sau vẫn đọc được body
                    async def receive():
                        return {"type": "http.request", "body": body_bytes}

                    request = Request(request.scope, receive=receive)

                    if "application/json" in content_type:
                        try:
                            raw_json = json.loads(body_bytes.decode("utf-8", errors="ignore"))
                            payload_data = sanitize_payload(raw_json)
                        except Exception:
                            payload_data = body_bytes.decode("utf-8", errors="ignore")[:3000]
                    elif "application/x-www-form-urlencoded" in content_type:
                        try:
                            parsed = parse_qs(body_bytes.decode("utf-8", errors="ignore"))
                            form_dict = {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}
                            payload_data = sanitize_payload(form_dict)
                        except Exception:
                            payload_data = body_bytes.decode("utf-8", errors="ignore")[:3000]
                    else:
                        payload_data = body_bytes.decode("utf-8", errors="ignore")[:3000]
                except Exception as e:
                    logger.debug(f"Không thể trích xuất body request ({path}): {e}")

        # 3. Chuyển request đến route handler
        response: Response = await call_next(request)

        # 4. Kiểm tra điều kiện ghi log cho request chưa đăng nhập
        already_logged = getattr(request.state, "audit_logged", False)
        should_record = False
        action = "ANONYMOUS_REQUEST"
        summary = ""

        if not already_logged:
            # Trường hợp A: Request chưa đăng nhập có gửi kèm Payload (POST, PUT, PATCH, DELETE)
            if not is_authenticated and has_payload:
                should_record = True
                if path.startswith("/api/auth/login"):
                    if response.status_code >= 400:
                        action = "AUTH_LOGIN_FAILED"
                        uname = payload_data.get("username") if isinstance(payload_data, dict) else None
                        summary = f"Đăng nhập thất bại (HTTP {response.status_code}): tài khoản '{uname or 'không rõ'}'"
                    else:
                        action = "USER_LOGIN"
                        summary = f"Đăng nhập thành công qua mật khẩu (HTTP {response.status_code})"
                elif path.startswith("/api/auth/register"):
                    if response.status_code >= 400:
                        action = "AUTH_REGISTER_FAILED"
                        summary = f"Đăng ký tài khoản thất bại (HTTP {response.status_code})"
                    else:
                        action = "USER_REGISTER"
                        summary = f"Đăng ký tài khoản mới thành công (HTTP {response.status_code})"
                elif path.startswith("/api/rag"):
                    action = "ANONYMOUS_RAG_QUERY"
                    summary = f"Khách chưa đăng nhập truy vấn AI RAG ({request.method} {path})"
                else:
                    action = "ANONYMOUS_MUTATION"
                    summary = f"Khách chưa đăng nhập gửi payload {request.method} tới {path} (HTTP {response.status_code})"

            # Trường hợp B: Bị chặn quyền truy cập (401 Unauthorized, 403 Forbidden)
            elif response.status_code in (401, 403):
                should_record = True
                action = "UNAUTHORIZED_ACCESS" if response.status_code == 401 else "FORBIDDEN_ACCESS"
                summary = f"Truy cập bị từ chối (HTTP {response.status_code}): {request.method} {path}"

        # 5. Lưu log nếu thỏa điều kiện
        if should_record:
            try:
                ip = get_client_ip(request)
                ua = get_user_agent(request)

                actor_name = "Khách vãng lai"
                actor_email = None

                if isinstance(payload_data, dict):
                    if payload_data.get("username"):
                        actor_name = f"Khách ({payload_data.get('username')})"
                    elif payload_data.get("email"):
                        actor_name = f"Khách ({payload_data.get('email')})"
                        actor_email = str(payload_data.get("email"))[:100]

                target_type = (
                    "auth" if "/auth/" in path else ("rag" if "/rag" in path else "api")
                )

                details_obj = {
                    "method": request.method,
                    "path": path,
                    "status_code": response.status_code,
                    "ip": ip,
                    "user_agent": ua,
                    "query_params": dict(request.query_params),
                    "payload": payload_data,
                    "is_authenticated": is_authenticated,
                }

                async with AsyncSessionLocal() as audit_db:
                    await record_audit_log(
                        db=audit_db,
                        action=action,
                        summary=summary,
                        actor_name=actor_name,
                        actor_email=actor_email,
                        target_type=target_type,
                        target_id=path[:255],
                        target_title=f"{request.method} {path}",
                        details=details_obj,
                        ip_address=ip,
                        user_agent=ua,
                    )
            except Exception as e:
                logger.error(f"Lỗi khi ghi audit log tự động trong middleware: {e}", exc_info=True)

        return response
