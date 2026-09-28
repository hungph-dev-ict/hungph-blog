from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.deps import get_current_admin
from app.modules.auth.models import User
from app.modules.blog.models import GlossaryTerm
from app.modules.blog.schemas import (
    GlossaryTermCreate,
    GlossaryTermResponse,
    GlossaryTermUpdate,
)

router = APIRouter(prefix="/glossary", tags=["Glossary"])


@router.get("", response_model=List[GlossaryTermResponse])
@router.get("/", response_model=List[GlossaryTermResponse])
async def get_glossary_terms(
    search: Optional[str] = Query(None, description="Tìm kiếm thuật ngữ"),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các thuật ngữ. Public API phục vụ highlight bài viết và tra cứu."""
    stmt = select(GlossaryTerm)
    if search:
        term_clean = search.strip().lower()
        stmt = stmt.where(
            func.lower(GlossaryTerm.term).contains(term_clean)
            | func.lower(GlossaryTerm.definition).contains(term_clean)
        )
    # Sắp xếp theo thuật ngữ theo thứ tự alphabet
    stmt = stmt.order_by(GlossaryTerm.term.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{term_id}", response_model=GlossaryTermResponse)
async def get_glossary_term_by_id(
    term_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lấy thông tin chi tiết một thuật ngữ theo ID."""
    stmt = select(GlossaryTerm).where(GlossaryTerm.id == term_id)
    res = await db.execute(stmt)
    term_obj = res.scalar_one_or_none()
    if not term_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thuật ngữ không tồn tại",
        )
    return term_obj


@router.post("", response_model=GlossaryTermResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=GlossaryTermResponse, status_code=status.HTTP_201_CREATED)
async def create_glossary_term(
    payload: GlossaryTermCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin tạo thuật ngữ mới."""
    term_str = payload.term.strip()
    definition_str = payload.definition.strip()

    if not term_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thuật ngữ không được để trống",
        )
    if not definition_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Giải thích thuật ngữ không được để trống",
        )

    # Kiểm tra trùng lặp (không phân biệt hoa thường)
    stmt = select(GlossaryTerm).where(func.lower(GlossaryTerm.term) == func.lower(term_str))
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Thuật ngữ "{term_str}" đã tồn tại trong hệ thống',
        )

    new_term = GlossaryTerm(
        term=term_str,
        definition=definition_str,
    )
    db.add(new_term)
    await db.commit()
    await db.refresh(new_term)
    return new_term


@router.put("/{term_id}", response_model=GlossaryTermResponse)
async def update_glossary_term(
    term_id: str,
    payload: GlossaryTermUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin cập nhật thuật ngữ hoặc định nghĩa."""
    stmt = select(GlossaryTerm).where(GlossaryTerm.id == term_id)
    res = await db.execute(stmt)
    term_obj = res.scalar_one_or_none()
    if not term_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thuật ngữ không tồn tại",
        )

    if payload.term is not None:
        term_str = payload.term.strip()
        if not term_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thuật ngữ không được để trống",
            )
        # Kiểm tra trùng tên với term khác
        dup_stmt = select(GlossaryTerm).where(
            func.lower(GlossaryTerm.term) == func.lower(term_str),
            GlossaryTerm.id != term_id,
        )
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Thuật ngữ "{term_str}" đã được sử dụng bởi một mục khác',
            )
        term_obj.term = term_str

    if payload.definition is not None:
        def_str = payload.definition.strip()
        if not def_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Giải thích thuật ngữ không được để trống",
            )
        term_obj.definition = def_str

    await db.commit()
    await db.refresh(term_obj)
    return term_obj


@router.delete("/{term_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_glossary_term(
    term_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin xóa thuật ngữ."""
    stmt = select(GlossaryTerm).where(GlossaryTerm.id == term_id)
    res = await db.execute(stmt)
    term_obj = res.scalar_one_or_none()
    if not term_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thuật ngữ không tồn tại",
        )

    await db.delete(term_obj)
    await db.commit()
    return None
