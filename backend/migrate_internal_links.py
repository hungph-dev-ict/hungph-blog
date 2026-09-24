"""Script migration: Tự động quét và chuẩn hóa toàn bộ các link nội bộ thô (raw URLs)
trong content_html của tất cả bài viết trên Database (cả SQLite local lẫn Supabase PostgreSQL production).
"""

import asyncio
import re
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

SUPABASE_DB_URL = "postgresql+asyncpg://postgres.cnswwonbfkwwjqihnctr:Doraemon1512%40123@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
SQLITE_DB_URL = "sqlite+aiosqlite:///./blog.db"

LINK_PATTERN = re.compile(
    r'<a\s+([^>]*?)href=["\'](?:https?://(?:hungph-blog\.vercel\.app|localhost:\d+))?/posts/([a-zA-Z0-9_\-]+)["\']([^>]*?)>(.*?)</a>',
    re.IGNORECASE | re.DOTALL
)

async def migrate_database(db_url: str, label: str):
    print(f"\n=======================================================")
    print(f"Bắt đầu chuẩn hóa link nội bộ trên: {label}")
    print(f"=======================================================")
    try:
        engine = create_async_engine(db_url)
        async with engine.begin() as conn:
            # 1. Lấy tất cả bài viết (id, slug, title) để làm bản đồ tra cứu
            res = await conn.execute(text("SELECT id, slug, title, content_html FROM posts"))
            all_posts = res.fetchall()
            slug_to_title = {r[1]: r[2] for r in all_posts if r[1] and r[2]}
            print(f"-> Đã tải {len(all_posts)} bài viết từ database. Số lượng slug có tiêu đề: {len(slug_to_title)}")

            updated_count = 0

            for post_id, slug, title, content_html in all_posts:
                if not content_html:
                    continue

                matches = list(LINK_PATTERN.finditer(content_html))
                if not matches:
                    continue

                has_changes = False

                def replace_match(m):
                    nonlocal has_changes
                    before, target_slug, after, inner_text = m.groups()
                    plain = re.sub(r'<[^>]+>', '', inner_text).strip()

                    # Kiểm tra xem text hiển thị có phải là raw URL không
                    is_raw = (
                        plain.startswith("http://")
                        or plain.startswith("https://")
                        or plain.startswith("/posts/")
                        or plain == target_slug
                    )

                    if is_raw and target_slug in slug_to_title:
                        post_title = slug_to_title[target_slug]
                        has_changes = True
                        print(f"   [Post: {slug}] Thay raw link -> '{post_title}'")
                        return f'<a {before}href="https://hungph-blog.vercel.app/posts/{target_slug}"{after}>{post_title}</a>'
                    return m.group(0)

                new_html = LINK_PATTERN.sub(replace_match, content_html)

                if has_changes:
                    await conn.execute(
                        text("UPDATE posts SET content_html = :html WHERE id = :id"),
                        {"html": new_html, "id": post_id}
                    )
                    updated_count += 1

            print(f"-> Hoàn tất {label}: Đã cập nhật {updated_count} bài viết có link thô!")
    except Exception as e:
        print(f"-> Lỗi khi migrate {label}: {e}")

async def main():
    # 1. Chạy trên Supabase Production
    await migrate_database(SUPABASE_DB_URL, "Supabase PostgreSQL (PRODUCTION)")
    # 2. Chạy trên SQLite Local nếu có
    await migrate_database(SQLITE_DB_URL, "SQLite (LOCAL)")

if __name__ == "__main__":
    asyncio.run(main())
