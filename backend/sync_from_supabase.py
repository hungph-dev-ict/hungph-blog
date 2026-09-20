"""
Script sao chép toàn bộ dữ liệu từ Supabase PostgreSQL về SQLite local (backend/blog.db)
giúp tăng tốc độ phát triển (development loading cực nhanh).
"""
import asyncio
import ssl
import sqlite3
import os
import asyncpg
from datetime import datetime

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("REMOTE_DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL") or "postgresql://postgres.cnswwonbfkwwjqihnctr:Doraemon1512%40123@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "blog.db")

TABLES_ORDER = [
    "users",
    "categories",
    "tags",
    "series",
    "chapters",
    "posts",
    "post_tags",
    "comments",
    "post_likes",
    "post_reports",
    "series_collaborators",
    "follows",
    "notifications",
]

async def sync():
    print(f"Connecting to Supabase...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    # Tạo tất cả các bảng nếu chưa có
    from app.core.database import Base
    from app.modules.auth.models import User
    from app.modules.blog.models import Category, Chapter, Comment, Post, PostLike, PostReport, Series, SeriesCollaborator, Tag, post_tags
    from app.modules.social.models import Follow, Notification
    from sqlalchemy import create_engine
    
    sync_engine = create_engine(f"sqlite:///{SQLITE_DB_PATH}")
    Base.metadata.create_all(sync_engine)

    pg_conn = await asyncpg.connect(SUPABASE_URL, ssl=ctx)
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.execute("PRAGMA foreign_keys = OFF;")

    for table in TABLES_ORDER:
        try:
            # Lấy thông tin cột của sqlite table
            cur = sqlite_conn.execute(f"PRAGMA table_info({table});")
            col_info = cur.fetchall()
            if not col_info:
                print(f"Bảng {table} chưa có trong SQLite, bỏ qua...")
                continue
            sqlite_cols = [c[1] for c in col_info]
            
            # Đọc từ Supabase
            rows = await pg_conn.fetch(f"SELECT * FROM {table};")
            if not rows:
                print(f"Bảng {table}: 0 dòng trên Supabase")
                continue
            
            pg_cols = list(rows[0].keys())
            common_cols = [col for col in pg_cols if col in sqlite_cols]
            
            # Xóa dữ liệu cũ trên SQLite
            sqlite_conn.execute(f"DELETE FROM {table};")
            
            # Chuẩn bị câu lệnh chèn với quote tên cột để tránh keyword như order
            placeholders = ",".join(["?" for _ in common_cols])
            col_names = ",".join([f'"{col}"' for col in common_cols])
            insert_sql = f'INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders});'
            
            batch_data = []
            for r in rows:
                row_vals = []
                for c in common_cols:
                    v = r[c]
                    if isinstance(v, datetime):
                        row_vals.append(v.isoformat())
                    elif isinstance(v, bool):
                        row_vals.append(1 if v else 0)
                    else:
                        row_vals.append(v)
                batch_data.append(row_vals)
            
            sqlite_conn.executemany(insert_sql, batch_data)
            sqlite_conn.commit()
            print(f"✓ Đã đồng bộ bảng {table}: {len(rows)} dòng")
        except Exception as e:
            print(f"Lỗi đồng bộ bảng {table}: {e}")

    sqlite_conn.execute("PRAGMA foreign_keys = ON;")
    sqlite_conn.close()
    await pg_conn.close()
    print("Hoàn tất đồng bộ dữ liệu về SQLite local!")

if __name__ == "__main__":
    asyncio.run(sync())
