import asyncio
import json
from typing import List
import urllib.request
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.modules.auth.deps import get_current_admin, get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import GoogleAuthRequest, Token, UserCreate, UserLogin, UserResponse, UserRoleUpdate, UserProfileUpdate

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    identifier = credentials.username_or_email.lower().strip()
    stmt = select(User).where((User.email == identifier) | (User.username == identifier))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username/email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/google", response_model=Token)
async def google_login(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Đăng nhập hoặc đăng ký bằng Google SSO cho độc giả & quản trị viên."""
    email = None
    name = None
    picture = None
    google_id = None

    if payload.credential:
        try:
            def verify_token(token_str):
                url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token_str}"
                req = urllib.request.Request(url, headers={"User-Agent": "HungPH-Blog"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    return json.loads(response.read().decode("utf-8"))

            info = await asyncio.to_thread(verify_token, payload.credential)
            email = info.get("email")
            name = info.get("name")
            picture = info.get("picture")
            google_id = info.get("sub")
        except Exception:
            raise HTTPException(status_code=400, detail="Xác thực Google ID token thất bại")
    elif payload.email:
        email = str(payload.email).lower().strip()
        name = payload.name or email.split("@")[0]
        picture = payload.picture
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp thông tin Google token hoặc Email")

    if not email:
        raise HTTPException(status_code=400, detail="Không tìm thấy email từ tài khoản Google")

    email = email.lower().strip()
    is_super_admin = (email == settings.ADMIN_EMAIL.lower())

    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        base_username = email.split("@")[0].replace(".", "_")
        username = base_username
        count = 1
        while True:
            u_stmt = select(User).where(User.username == username)
            u_res = await db.execute(u_stmt)
            if not u_res.scalar_one_or_none():
                break
            username = f"{base_username}_{count}"
            count += 1

        user = User(
            email=email,
            username=username,
            full_name=name or username,
            avatar_url=picture,
            google_id=google_id,
            hashed_password=get_password_hash(str(uuid.uuid4())),
            role="admin" if is_super_admin else "member",
            is_admin=is_super_admin,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        changed = False
        if is_super_admin and (user.role != "admin" or not user.is_admin):
            user.role = "admin"
            user.is_admin = True
            changed = True
        if picture and not user.avatar_url:
            user.avatar_url = picture
            changed = True
        if name and not user.full_name:
            user.full_name = name
            changed = True
        if google_id and not user.google_id:
            user.google_id = google_id
            changed = True
        if changed:
            await db.commit()
            await db.refresh(user)

    access_token = create_access_token(subject=user.id)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/setup", response_model=UserResponse)
async def initial_setup(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Initialize the first super admin user if no users exist in the system."""
    stmt = select(User)
    result = await db.execute(stmt)
    existing_users = result.scalars().all()
    if len(existing_users) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Initial setup already completed. Please login."
        )

    user = User(
        email=user_in.email.lower().strip(),
        username=user_in.username.strip(),
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role="admin",
        is_admin=True,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    payload: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Người dùng cập nhật thông tin cá nhân (Họ tên, ảnh đại diện, tiểu sử / bio)."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip() or None
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() or None
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None

    await db.commit()
    await db.refresh(current_user)
    return current_user


# --- USER & MEMBER MANAGEMENT (Admin Only) ---

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin xem danh sách toàn bộ thành viên trong hệ thống."""
    stmt = select(User).order_by(desc(User.created_at))
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin cấp hoặc thu hồi quyền quản trị / đổi quyền thành viên."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thành viên")

    if user.id == admin.id and payload.role != "admin":
        raise HTTPException(status_code=400, detail="Bạn không thể tự hạ quyền quản trị của chính mình")

    if payload.role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail="Role phải là 'admin' hoặc 'member'")

    user.role = payload.role
    user.is_admin = (payload.role == "admin")
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin xóa tài khoản thành viên khỏi hệ thống."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Không thể xóa tài khoản của chính mình")
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thành viên")
    await db.delete(user)
    await db.commit()
    return None
