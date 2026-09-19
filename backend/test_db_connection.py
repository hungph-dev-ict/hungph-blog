"""
Script kiểm tra kết nối Supabase PostgreSQL nhanh chóng
Cách chạy:
    source venv/bin/activate
    python test_db_connection.py
"""

import asyncio
import sys
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal, Base
from app.main import init_default_data


async def main():
    print("=" * 60)
    print("🔍 Đang kiểm tra kết nối cơ sở dữ liệu...")
    print(f"📌 URL cấu hình: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print("=" * 60)

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT version();"))
            version = result.scalar()
            print("✅ KẾT NỐI THÀNH CÔNG!")
            print(f"📊 PostgreSQL Version: {version}\n")

        print("🚀 Đang tự động kiểm tra và khởi tạo các bảng (Users, Categories, Posts, Series)...")
        await init_default_data()
        print("🎉 TẤT CẢ BẢNG VÀ DỮ LIỆU MẪU ĐÃ SẴN SÀNG TRÊN SUPABASE!")
        print("=" * 60)
    except Exception as e:
        print("\n❌ KẾT NỐI THẤT BẠI:")
        print(f"Chi tiết lỗi: {e}")
        print("\n💡 Gợi ý khắc phục:")
        print("1. Kiểm tra lại mật khẩu (password) trong DATABASE_URL.")
        print("2. Đảm bảo dùng connection string dạng URI (Session Pooler hoặc Direct).")
        print("3. Kiểm tra xem dự án Supabase có đang ở trạng thái Active không.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
