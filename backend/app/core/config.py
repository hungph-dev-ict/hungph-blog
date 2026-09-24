import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "HungPH Blog Platform"
    API_V1_STR: str = "/api"
    
    # Database: Supports SQLite locally or PostgreSQL on Render/Neon/Supabase
    # When deployed to Render with standard postgres:// URL, we auto-convert to postgresql+asyncpg://
    DATABASE_URL: str = "sqlite+aiosqlite:///./blog.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().strip("'").strip('"')
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            
            # Loại bỏ query sslmode=... vì asyncpg nhận cấu hình SSL qua connect_args
            if "?" in v:
                base, query = v.split("?", 1)
                params = [p for p in query.split("&") if not p.startswith("sslmode=")]
                v = f"{base}?{'&'.join(params)}" if params else base
        return v

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-replace-in-production-hungph-blog-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        return ["*"]

    # Initial Admin Seed
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@hungph.dev")
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@123456")

    # Cloudinary (optional for production image hosting)
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    # Gemini AI — dùng cho RAG Q&A
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")


settings = Settings()
