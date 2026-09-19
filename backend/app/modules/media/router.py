import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.core.config import settings
from app.modules.auth.deps import get_current_admin
from app.modules.auth.models import User

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class UploadResponse(BaseModel):
    url: str
    filename: str


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    admin: User = Depends(get_current_admin)
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Check if Cloudinary is configured
    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
        try:
            import cloudinary
            import cloudinary.uploader
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET
            )
            upload_result = cloudinary.uploader.upload(
                content,
                folder="hungph_blog",
                resource_type="image"
            )
            return UploadResponse(
                url=upload_result.get("secure_url"),
                filename=file.filename
            )
        except Exception as e:
            # Fallback to local storage if Cloudinary upload fails
            print(f"Cloudinary upload failed ({e}), falling back to local storage")

    # Local file storage
    uploads_dir = os.path.join(os.getcwd(), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(uploads_dir, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    return UploadResponse(
        url=f"/uploads/{unique_filename}",
        filename=file.filename
    )
