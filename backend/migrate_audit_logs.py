import asyncio
import os
import ssl
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "blog.db")
SQLITE_DB_URL = f"sqlite+aiosqlite:///{SQLITE_PATH}"
SUPABASE_DB_URL = os.getenv("REMOTE_DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL") or "postgresql+asyncpg://postgres.cnswwonbfkwwjqihnctr:Doraemon1512%40123@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

POSTGRES_SQL = """
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(100),
    actor_email VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(30),
    target_id VARCHAR(255),
    target_title VARCHAR(255),
    summary TEXT NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(300),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_target_type ON audit_logs (target_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_ip_address ON audit_logs (ip_address);
"""

SQLITE_SQL = """
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(100),
    actor_email VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(30),
    target_id VARCHAR(255),
    target_title VARCHAR(255),
    summary TEXT NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(300),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_target_type ON audit_logs (target_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_ip_address ON audit_logs (ip_address);
"""


async def migrate_sqlite():
    print(f"--> Migrating SQLite: {SQLITE_PATH}")
    engine = create_async_engine(SQLITE_DB_URL, echo=False)
    async with engine.begin() as conn:
        for stmt in SQLITE_SQL.strip().split(";"):
            cleaned = stmt.strip()
            if cleaned:
                await conn.execute(text(cleaned))
    await engine.dispose()
    print("✓ SQLite migration complete!")


async def migrate_supabase():
    print(f"--> Migrating Supabase PostgreSQL...")
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    engine = create_async_engine(
        SUPABASE_DB_URL,
        connect_args={"ssl": ssl_ctx, "statement_cache_size": 0},
        echo=False
    )
    async with engine.begin() as conn:
        for stmt in POSTGRES_SQL.strip().split(";"):
            cleaned = stmt.strip()
            if cleaned:
                await conn.execute(text(cleaned))
    await engine.dispose()
    print("✓ Supabase PostgreSQL migration complete!")


async def main():
    await migrate_sqlite()
    await migrate_supabase()
    print("\n🎉 Tất cả migration bảng audit_logs đã hoàn thành thành công!")


if __name__ == "__main__":
    asyncio.run(main())
