import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.core.config import settings
from app.core.database import Base, engine, AsyncSessionLocal
from app.core.security import get_password_hash
from app.modules.auth.models import User
from app.modules.auth.router import router as auth_router
from app.modules.blog.models import Category, Chapter, Post, Series, Tag
from app.modules.blog.router import router as blog_router
from app.modules.media.router import router as media_router
from app.modules.rag.router import router as rag_router
from app.modules.utilities.router import router as utilities_router


async def init_default_data():
    """Tự động khởi tạo bảng và dữ liệu mẫu nếu database đang trống."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Bổ sung các cột mới nếu bảng users đã tồn tại trước đó
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100);"))
        except Exception as mig_err:
            print(f"Migration note: {mig_err}")

    async with AsyncSessionLocal() as db:
        # Kiểm tra Admin
        stmt = select(User).where(User.username == settings.ADMIN_USERNAME)
        res = await db.execute(stmt)
        admin = res.scalar_one_or_none()

        if not admin:
            admin = User(
                email=settings.ADMIN_EMAIL,
                username=settings.ADMIN_USERNAME,
                full_name="Hung Pham Hoang",
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                is_admin=True,
                is_active=True
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)

        # Kiểm tra Category mẫu
        stmt_cat = select(Category)
        res_cat = await db.execute(stmt_cat)
        if not res_cat.scalars().first():
            cat_tech = Category(name="Kỹ Thuật & Công Nghệ", slug="ky-thuat-cong-nghe", description="Chia sẻ về lập trình, kiến trúc hệ thống và AI")
            cat_life = Category(name="Góc Nhìn & Cuộc Sống", slug="goc-nhin-cuoc-song", description="Những bài học và trải nghiệm thường nhật")
            db.add_all([cat_tech, cat_life])
            await db.commit()

            # Thẻ mẫu
            tag1 = Tag(name="NextJS", slug="nextjs")
            tag2 = Tag(name="FastAPI", slug="fastapi")
            tag3 = Tag(name="RAG", slug="rag")
            db.add_all([tag1, tag2, tag3])
            await db.commit()

            # Bài viết chào mừng
            welcome_post = Post(
                title="Chào Mừng Bạn Đến Với Blog Cá Nhân Mới Của Tôi!",
                slug="chao-mung-ban-den-voi-blog-ca-nhan-moi",
                summary="Giới thiệu về kiến trúc blog hiện đại: Next.js trên Vercel kết hợp FastAPI trên Render, hỗ trợ viết lách chuẩn Notion/WordPress và sẵn sàng cho AI RAG.",
                content_html="""<h2>Xin chào, tôi là Hùng!</h2>
<p>Chào mừng bạn ghé thăm không gian viết lách và chia sẻ kiến thức của tôi. Đây là phiên bản blog được xây dựng với mục tiêu:</p>
<ul>
    <li><strong>Trải nghiệm đọc tinh gọn:</strong> Giao diện tối giản, chuẩn typography hiện đại, hỗ trợ Dark Mode và thời lượng đọc.</li>
    <li><strong>Trải nghiệm viết lách mượt mà:</strong> Trình soạn thảo trực quan như Notion/WordPress, hỗ trợ định dạng phong phú và chèn ảnh.</li>
    <li><strong>Khả năng mở rộng không giới hạn:</strong> Backend tách biệt bằng Python FastAPI, sẵn sàng cắm thêm module tìm kiếm ngữ nghĩa RAG (Retrieval-Augmented Generation) và bộ công cụ cá nhân (Utilities).</li>
</ul>
<blockquote>Mục tiêu của blog là nơi ghi lại hành trình học hỏi, những suy ngẫm về công nghệ và cuộc sống.</blockquote>
<p>Chúc bạn có những phút giây đọc bài thú vị!</p>""",
                cover_image="https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80",
                is_published=True,
                reading_time_minutes=2,
                author_id=admin.id,
                category_id=cat_tech.id,
                tags=[tag1, tag2, tag3]
            )
            db.add(welcome_post)
            await db.commit()

        # Kiểm tra Series / Khóa học mẫu
        stmt_series = select(Series)
        res_series = await db.execute(stmt_series)
        if not res_series.scalars().first():
            stmt_cat = select(Category).where(Category.slug == "ky-thuat-cong-nghe")
            cat_res = await db.execute(stmt_cat)
            cat_tech = cat_res.scalar_one_or_none()

            sample_course = Series(
                title="Prep Course: Chinh Phục AI, RAG & Kiến Trúc Hệ Thống Hiện Đại",
                slug="prep-course-chinh-phuc-ai-va-rag",
                summary="Lộ trình toàn diện học từ nền tảng: Thiết kế hệ thống Backend FastAPI, Lưu trữ Vector với pgvector, và xây dựng ứng dụng RAG thông minh.",
                cover_image="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
                is_published=True,
                category_id=cat_tech.id if cat_tech else None
            )
            db.add(sample_course)
            await db.commit()
            await db.refresh(sample_course)

            # Chương 1
            ch1 = Chapter(
                series_id=sample_course.id,
                title="Chương 1: Nền Tảng & Tổng Quan Hệ Thống",
                order=1,
                description="Tìm hiểu bài toán cốt lõi, kiến trúc tổng thể và các công nghệ chủ chốt."
            )
            # Chương 2
            ch2 = Chapter(
                series_id=sample_course.id,
                title="Chương 2: Lưu Trữ Vector & Triển Khai Thực Chiến",
                order=2,
                description="Thực hành thiết kế CSDL với pgvector và tích hợp vào dự án."
            )
            db.add_all([ch1, ch2])
            await db.commit()
            await db.refresh(ch1)
            await db.refresh(ch2)

            # Bài 1.1 trong Chương 1
            lesson1 = Post(
                title="Bài 1: Tại Sao RAG Lại Là Tương Lai Của Ứng Dụng AI?",
                slug="bai-1-tai-sao-rag-la-tuong-lai-cua-ung-dung-ai",
                summary="Khám phá hạn chế của mô hình LLM thuần túy và lý do tại sao kiến trúc RAG (Retrieval-Augmented Generation) trở thành tiêu chuẩn công nghiệp.",
                content_html="""<h2>1. Vấn đề của mô hình ngôn ngữ lớn (LLM)</h2>
<p>Mặc dù các mô hình như GPT-4 hay Gemini vô cùng thông minh, chúng vẫn gặp phải hai nhược điểm cốt tử:</p>
<ol>
    <li><strong>Ảo giác (Hallucination):</strong> Tự bịa đặt thông tin khi không có dữ liệu chắc chắn.</li>
    <li><strong>Dữ liệu tĩnh:</strong> Không có kiến thức về dữ liệu nội bộ riêng tư hoặc thông tin mới cập nhật theo thời gian thực.</li>
</ol>
<h2>2. Giải pháp mang tên RAG</h2>
<p>RAG giải quyết vấn đề này bằng cách tra cứu các đoạn tài liệu chính xác nhất từ cơ sở dữ liệu (Database/Vector DB) rồi cung cấp làm ngữ cảnh cho mô hình trả lời.</p>
<blockquote>RAG = Retrieval (Tra cứu) + Augmentation (Bổ sung ngữ cảnh) + Generation (Sinh câu trả lời).</blockquote>
<p>Trong bài học tiếp theo, chúng ta sẽ bắt tay vào thiết lập môi trường và cấu trúc thư mục backend.</p>""",
                cover_image="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
                is_published=True,
                reading_time_minutes=3,
                author_id=admin.id,
                category_id=cat_tech.id if cat_tech else None,
                series_id=sample_course.id,
                chapter_id=ch1.id,
                order_in_chapter=1
            )

            # Bài 1.2 trong Chương 1
            lesson2 = Post(
                title="Bài 2: Thiết Kế Kiến Trúc Backend Độc Lập Cho Khóa Học & RAG",
                slug="bai-2-thiet-ke-kien-truc-backend-doc-lap",
                summary="Cấu trúc Modular Monolith với Python FastAPI: Tách biệt rõ ràng giữa Auth, Blog, Media và RAG AI.",
                content_html="""<h2>Kiến trúc Modular Monolith là gì?</h2>
<p>Thay vì chia nhỏ thành quá nhiều microservices phức tạp ngay từ đầu, Modular Monolith giúp bạn gom code vào một ứng dụng duy nhất nhưng phân tách các module cực kỳ sạch sẽ.</p>
<pre><code>app/
  core/         # Kết nối CSDL, bảo mật
  modules/
    auth/       # Xác thực
    blog/       # Quản lý bài viết & Khóa học
    rag/        # Xử lý AI RAG
</code></pre>
<p>Cách tiếp cận này giúp việc mở rộng sau này không tốn nhiều công sức bảo trì hạ tầng.</p>""",
                cover_image="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
                is_published=True,
                reading_time_minutes=4,
                author_id=admin.id,
                category_id=cat_tech.id if cat_tech else None,
                series_id=sample_course.id,
                chapter_id=ch1.id,
                order_in_chapter=2
            )

            # Bài 2.1 trong Chương 2
            lesson3 = Post(
                title="Bài 3: Tìm Hiểu Vector Search & Tích Hợp Extension pgvector",
                slug="bai-3-tim-hieu-vector-search-va-pgvector",
                summary="Hướng dẫn kích hoạt pgvector trên PostgreSQL để biến cơ sở dữ liệu quan hệ thành kho lưu trữ vector mạnh mẽ.",
                content_html="""<h2>Tại sao chọn pgvector thay vì thuê Vector DB riêng?</h2>
<p>Thông thường các dự án nhỏ phải thuê thêm Pinecone hoặc Qdrant. Với <strong>pgvector</strong>:</p>
<ul>
    <li>Bạn dùng chung một cơ sở dữ liệu PostgreSQL cho cả dữ liệu quan hệ lẫn vector.</li>
    <li>Không tốn thêm chi phí duy trì hệ thống ngoài.</li>
    <li>Hỗ trợ câu lệnh SQL chuẩn để tìm kiếm độ tương đồng cosine similarity: <code>ORDER BY embedding &lt;=&gt; query_vector LIMIT 5;</code></li>
</ul>
<p>Đây là giải pháp tối ưu chi phí hoàn hảo khi triển khai trên Render, Neon hoặc Supabase.</p>""",
                cover_image="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
                is_published=True,
                reading_time_minutes=5,
                author_id=admin.id,
                category_id=cat_tech.id if cat_tech else None,
                series_id=sample_course.id,
                chapter_id=ch2.id,
                order_in_chapter=1
            )

            db.add_all([lesson1, lesson2, lesson3])
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi động: Tạo thư mục uploads và dữ liệu mẫu
    os.makedirs(os.path.join(os.getcwd(), "uploads"), exist_ok=True)
    try:
        await init_default_data()
    except Exception as e:
        print(f"Lưu ý khi khởi tạo DB: {e}")
    yield
    # Dọn dẹp khi tắt server
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="RESTful API cho Blog cá nhân hiện đại, hỗ trợ mở rộng RAG & Tiện ích",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.CORS_ORIGINS == ["*"] else settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving cho ảnh uploads local
uploads_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Đăng ký API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(blog_router, prefix=settings.API_V1_STR)
app.include_router(media_router, prefix=settings.API_V1_STR)
app.include_router(rag_router, prefix=settings.API_V1_STR)
app.include_router(utilities_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "endpoints": {
            "auth": f"{settings.API_V1_STR}/auth",
            "blog": f"{settings.API_V1_STR}/blog",
            "media": f"{settings.API_V1_STR}/media",
            "rag": f"{settings.API_V1_STR}/rag",
            "utilities": f"{settings.API_V1_STR}/utilities",
        }
    }
