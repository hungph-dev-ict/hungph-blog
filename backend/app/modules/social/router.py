from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.core.database import get_db
from app.modules.auth.deps import get_current_user, get_optional_user
from app.modules.auth.models import User
from app.modules.social.models import Follow, Notification

router = APIRouter(tags=["Social"])


# ──────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────

class UserBrief(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    model_config = {"from_attributes": True}


class FollowStatus(BaseModel):
    is_following: bool
    followers_count: int
    following_count: int


class NotificationResponse(BaseModel):
    id: str
    type: str
    actor_id: Optional[str] = None
    actor: Optional[UserBrief] = None
    target_id: Optional[str] = None
    target_type: Optional[str] = None
    message: Optional[str] = None
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    count: int


# ──────────────────────────────────────────────────────────────
# Helper: create notification
# ──────────────────────────────────────────────────────────────

async def create_notification(
    db: AsyncSession,
    user_id: str,
    actor_id: str,
    notif_type: str,
    target_id: Optional[str] = None,
    target_type: Optional[str] = None,
    message: Optional[str] = None,
):
    notif = Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=notif_type,
        target_id=target_id,
        target_type=target_type,
        message=message,
    )
    db.add(notif)
    await db.commit()


# ──────────────────────────────────────────────────────────────
# FOLLOW
# ──────────────────────────────────────────────────────────────

@router.post("/social/follow/{user_id}", response_model=FollowStatus)
async def toggle_follow(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể tự theo dõi chính mình")

    # Check target user exists
    target = await db.get(User, user_id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại")

    # Check existing follow
    stmt = select(Follow).where(
        and_(Follow.follower_id == current_user.id, Follow.following_id == user_id)
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        # Unfollow
        await db.delete(existing)
        await db.commit()
        is_following = False
    else:
        # Follow
        follow = Follow(follower_id=current_user.id, following_id=user_id)
        db.add(follow)
        await db.commit()
        is_following = True
        # Create notification for the followed user
        actor_name = current_user.full_name or current_user.username
        await create_notification(
            db, user_id, current_user.id,
            "new_follower",
            message=f"{actor_name} đã bắt đầu theo dõi bạn"
        )

    # Counts
    followers_count = (await db.execute(
        select(func.count()).where(Follow.following_id == user_id)
    )).scalar() or 0
    following_count = (await db.execute(
        select(func.count()).where(Follow.follower_id == current_user.id)
    )).scalar() or 0

    return FollowStatus(
        is_following=is_following,
        followers_count=followers_count,
        following_count=following_count,
    )


@router.get("/social/follow-status/{user_id}", response_model=FollowStatus)
async def get_follow_status(
    user_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    is_following = False
    if current_user:
        stmt = select(Follow).where(
            and_(Follow.follower_id == current_user.id, Follow.following_id == user_id)
        )
        result = await db.execute(stmt)
        is_following = result.scalar_one_or_none() is not None

    followers_count = (await db.execute(
        select(func.count()).where(Follow.following_id == user_id)
    )).scalar() or 0
    following_count = (await db.execute(
        select(func.count()).where(Follow.follower_id == user_id)
    )).scalar() or 0

    return FollowStatus(
        is_following=is_following,
        followers_count=followers_count,
        following_count=following_count,
    )


@router.get("/social/followers/{user_id}", response_model=List[UserBrief])
async def get_followers(user_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Follow.follower_id).where(Follow.following_id == user_id)
    result = await db.execute(stmt)
    follower_ids = [r[0] for r in result.fetchall()]
    if not follower_ids:
        return []
    users_stmt = select(User).where(User.id.in_(follower_ids))
    users_result = await db.execute(users_stmt)
    return [UserBrief.model_validate(u) for u in users_result.scalars().all()]


@router.get("/social/following/{user_id}", response_model=List[UserBrief])
async def get_following(user_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Follow.following_id).where(Follow.follower_id == user_id)
    result = await db.execute(stmt)
    following_ids = [r[0] for r in result.fetchall()]
    if not following_ids:
        return []
    users_stmt = select(User).where(User.id.in_(following_ids))
    users_result = await db.execute(users_stmt)
    return [UserBrief.model_validate(u) for u in users_result.scalars().all()]


# ──────────────────────────────────────────────────────────────
# NOTIFICATIONS
# ──────────────────────────────────────────────────────────────

@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (await db.execute(
        select(func.count()).where(
            and_(Notification.user_id == current_user.id, Notification.is_read == False)
        )
    )).scalar() or 0
    return UnreadCountResponse(count=count)


@router.get("/notifications/", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    notifs = result.scalars().all()

    out = []
    for n in notifs:
        actor = None
        if n.actor_id:
            actor_obj = await db.get(User, n.actor_id)
            if actor_obj:
                actor = UserBrief.model_validate(actor_obj)
        out.append(NotificationResponse(
            id=n.id,
            type=n.type,
            actor_id=n.actor_id,
            actor=actor,
            target_id=n.target_id,
            target_type=n.target_type,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at,
        ))
    return out


@router.put("/notifications/{notif_id}/read")
async def mark_read(
    notif_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif = await db.get(Notification, notif_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")
    notif.is_read = True
    await db.commit()
    return {"ok": True}


@router.put("/notifications/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import update
    await db.execute(
        update(Notification)
        .where(and_(Notification.user_id == current_user.id, Notification.is_read == False))
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


# ──────────────────────────────────────────────────────────────
# PUBLIC: User profile
# ──────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    followers_count: int
    following_count: int
    model_config = {"from_attributes": True}


@router.get("/social/profile/{username}", response_model=UserProfileResponse)
async def get_user_profile(username: str, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại")

    followers_count = (await db.execute(
        select(func.count()).where(Follow.following_id == user.id)
    )).scalar() or 0
    following_count = (await db.execute(
        select(func.count()).where(Follow.follower_id == user.id)
    )).scalar() or 0

    return UserProfileResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        followers_count=followers_count,
        following_count=following_count,
    )
