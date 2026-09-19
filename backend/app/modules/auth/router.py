import asyncio
import json
import urllib.request
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import GoogleAuthRequest, Token, UserCreate, UserLogin, UserResponse

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
    """Đăng nhập hoặc đăng ký nhanh bằng Google / Gmail cho độc giả bình luận."""
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
            is_admin=False,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        changed = False
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
