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
from app.modules.social.models import Follow, Notification  # registers tables
from app.modules.social.router import router as social_router
from app.modules.audit.models import AuditLog  # registers audit_logs table
from app.modules.audit.router import router as audit_router


async def init_default_data():
    """Tự động khởi tạo bảng và dữ liệu mẫu nếu database đang trống."""
    from sqlalchemy import text
    is_sqlite = "sqlite" in settings.DATABASE_URL

    # 1. Tạo tất cả bảng nếu chưa có
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Lưu ý create_all: {e}")

    # 2. Bổ sung các cột mới cho các bảng đã tồn tại từ trước (mỗi cột chạy trong transaction riêng biệt)
    migrations = [
        ("users", "avatar_url", "VARCHAR(500)"),
        ("users", "bio", "VARCHAR(500)"),
        ("users", "google_id", "VARCHAR(100)"),
        ("users", "role", "VARCHAR(20) DEFAULT 'member'"),
        ("series", "owner_id", "VARCHAR(36)"),
        ("series", "hierarchy_config", "TEXT DEFAULT '[\"Chương\"]'"),
        ("series", "attribution_text", "TEXT"),
        ("chapters", "parent_id", "VARCHAR(36)"),
        ("chapters", "level", "INT DEFAULT 1"),
        ("posts", "is_spotlight", "BOOLEAN DEFAULT FALSE"),
    ]
    for tbl, col, col_def in migrations:
        try:
            async with engine.begin() as conn:
                if is_sqlite:
                    await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_def};"))
                else:
                    await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS {col} {col_def};"))
        except Exception:
            pass

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
                role="admin",
                is_admin=True,
                is_active=True
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
        else:
            if admin.role != "admin" or not admin.is_admin:
                admin.role = "admin"
                admin.is_admin = True
                await db.commit()
            await db.refresh(admin)

        # Kiểm tra Thành viên mẫu (Demo Member) phục vụ kiểm thử phân quyền
        stmt_member = select(User).where(User.username == "member_demo")
        res_member = await db.execute(stmt_member)
        member = res_member.scalar_one_or_none()
        if not member:
            member = User(
                email="member@hungph.dev",
                username="member_demo",
                full_name="Thành Viên Demo",
                hashed_password=get_password_hash("Member@123456"),
                role="member",
                is_admin=False,
                is_active=True
            )
            db.add(member)
            await db.commit()
            await db.refresh(member)
        else:
            member.hashed_password = get_password_hash("Member@123456")
            member.role = "member"
            member.is_admin = False
            await db.commit()

        # Gán tác giả mặc định cho bất kỳ series nào chưa có owner_id
        if admin:
            from sqlalchemy import update
            await db.execute(
                update(Series)
                .where(Series.owner_id.is_(None))
                .values(owner_id=admin.id)
            )
            await db.commit()

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
                content_html="""<h2>Xin chào, tôi là Hưng!</h2>
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

        # Kiểm tra bài viết kiến trúc RAG
        stmt_rag_post = select(Post).where(Post.slug == "kien-truc-rag-retrieval-augmented-generation-cua-blog")
        res_rag_post = await db.execute(stmt_rag_post)
        existing_rag_post = res_rag_post.scalars().first()

        rag_title = "Kiến Trúc RAG Toàn Diện (Retrieval-Augmented Generation): Từ Lý Thuyết Đến Hệ Thống Production Triệu Tokens"
        rag_summary = "Cẩm nang kỹ thuật chuyên sâu về RAG: Phân tích chi tiết Naive vs Advanced vs Modular RAG, kỹ thuật Semantic Chunking, Vector Space với FAISS & pgvector, kỹ thuật chống ảo giác (Hallucination) và case study kiến trúc đang vận hành trực tiếp trên HungPH.Blog."
        rag_content = """<p class="lead">Trong làn sóng bùng nổ của Generative AI, có một câu hỏi mà mọi kỹ sư hệ thống và kiến trúc sư phần mềm đều phải đối mặt: <em>Làm thế nào để các mô hình ngôn ngữ lớn (LLM) trả lời chính xác dựa trên kho tri thức riêng biệt, bảo mật và thay đổi liên tục của doanh nghiệp mà không tốn hàng chục ngàn USD để fine-tune mỗi tuần?</em> Câu trả lời tiêu chuẩn công nghiệp hiện nay chính là <strong>RAG (Retrieval-Augmented Generation)</strong>.</p>

<p>Bài viết này là một cẩm nang kỹ thuật toàn diện — đi từ bản chất toán học của vector embedding, các chiến lược phân đoạn văn bản (chunking), giải thuật tìm kiếm tương đồng, cho đến việc phân tích kiến trúc RAG thực tế đang chạy ngầm ngay trên chính hệ thống <strong>HungPH.Blog</strong> này.</p>

<h2>1. Vấn đề cốt tử của LLM thuần túy &amp; Tại sao Fine-Tuning không phải chìa khóa vạn năng?</h2>

<p>Mặc dù các siêu mô hình như GPT-4, Gemini 2.5 Flash hay Claude 3.5 Sonnet sở hữu khả năng suy luận phi thường, chúng vẫn mang trong mình 3 điểm yếu cố hữu:</p>

<ol>
    <li><strong>Ảo giác (Hallucination):</strong> Khi thiếu dữ kiện xác thực, mô hình có xu hướng "tự tin bịa đặt" các thông tin nghe rất thuyết phục nhưng sai lệch hoàn toàn thực tế.</li>
    <li><strong>Giới hạn điểm cắt tri thức (Knowledge Cutoff):</strong> Trọng số của mô hình bị đóng băng tại thời điểm huấn luyện xong. Chúng hoàn toàn mù tịt trước những bài viết bạn vừa đăng 5 phút trước.</li>
    <li><strong>Không có quyền truy cập dữ liệu nội bộ riêng tư:</strong> Dữ liệu bí mật kinh doanh, ghi chú cá nhân hay tài liệu kiến trúc hệ thống không nằm trong dữ liệu huấn luyện công khai của OpenAI hay Google.</li>
</ol>

<blockquote>
    <strong>Quy tắc vàng:</strong> <em>Fine-tuning dùng để dạy mô hình <strong>phong cách hoặc kỹ năng mới</strong> (Style, Tone, Format, Syntax). Còn RAG dùng để cung cấp cho mô hình <strong>tri thức thực tế và dữ liệu cập nhật</strong> (Knowledge, Facts, Context).</em> Cố gắng dùng Fine-tuning để cập nhật kiến thức thường xuyên là con đường ngắn nhất dẫn đến thảm họa chi phí và thảm họa quên tri thức cũ (Catastrophic Forgetting).
</blockquote>

<h2>2. Sự tiến hóa của kiến trúc RAG: Từ Naive đến Modular</h2>

<p>Để xây dựng hệ thống RAG đẳng cấp enterprise, bạn cần hiểu rõ 3 cấp độ kiến trúc RAG hiện nay:</p>

<table>
    <thead>
        <tr>
            <th>Tiêu chí</th>
            <th>Naive RAG</th>
            <th>Advanced RAG</th>
            <th>Modular / Agentic RAG</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Quy trình</strong></td>
            <td>Chunk &rarr; Embed &rarr; Top-K &rarr; LLM</td>
            <td>Pre-retrieval + Hybrid Search + Re-ranking</td>
            <td>Routing + Tool Calling + Self-Correction</td>
        </tr>
        <tr>
            <td><strong>Độ chính xác</strong></td>
            <td>Trung bình (dễ lệch ngữ cảnh)</td>
            <td>Cao (lọc nhiễu tốt)</td>
            <td>Rất cao (khả năng tự sửa lỗi)</td>
        </tr>
        <tr>
            <td><strong>Độ trễ (Latency)</strong></td>
            <td>Rất thấp (~300ms - 800ms)</td>
            <td>Trung bình (~1s - 2s)</td>
            <td>Cao (~2s - 5s)</td>
        </tr>
        <tr>
            <td><strong>Độ phức tạp</strong></td>
            <td>Cơ bản (Proof of Concept)</td>
            <td>Tiêu chuẩn Production</td>
            <td>Hệ thống Multi-Agent phức hợp</td>
        </tr>
    </tbody>
</table>

<h3>A. Naive RAG (Cơ bản nhưng mong manh)</h3>
<p>Naive RAG cắt phẳng văn bản thành các đoạn 500 từ, đưa vào Vector DB, truy vấn Top-5 đoạn gần nhất theo Cosine Distance và nhét vào Prompt. Hạn chế chết người ở đây là: Câu hỏi của người dùng thường ngắn và thiếu ngữ nghĩa, dẫn đến việc lấy nhầm các chunk có từ vựng tương đồng nhưng sai bản chất vấn đề.</p>

<h3>B. Advanced RAG (Tiêu chuẩn công nghiệp)</h3>
<p>Bổ sung hai tầng xử lý quan trọng:</p>
<ul>
    <li><strong>Pre-retrieval:</strong> Mở rộng câu hỏi (Query Expansion), HyDE (Hypothetical Document Embeddings), hoặc viết lại câu hỏi dựa trên lịch sử hội thoại.</li>
    <li><strong>Post-retrieval:</strong> Sử dụng mô hình <em>Cross-Encoder Re-ranker</em> để chấm điểm lại Top-20 tài liệu thô, sau đó chỉ chọn ra 3-5 đoạn xuất sắc nhất chuyển cho LLM, giảm thiểu hiện tượng "Lost in the Middle".</li>
</ul>

<h3>C. Modular &amp; Agentic RAG (Tương lai của AI)</h3>
<p>Mô hình tự quyết định: Câu hỏi này có cần tìm kiếm tài liệu không? Nếu kết quả tìm kiếm không đủ tin cậy, Agent sẽ tự động chuyển sang Web Search hoặc yêu cầu người dùng làm rõ câu hỏi.</p>

<h2>3. Nghệ thuật Document Chunking: Chia nhỏ văn bản thế nào để giữ trọn ngữ nghĩa?</h2>

<p>Chất lượng đầu ra của RAG bị giới hạn bởi chất lượng của các mẩu dữ liệu nhỏ (Chunks). Nếu chunk quá nhỏ, mô hình mất ngữ cảnh; nếu chunk quá lớn, vector embedding bị loãng và lẫn nhiều tạp âm.</p>

<h3>Chiến lược Semantic Chunking vs Fixed-size Overlap</h3>
<p>Thay vì cắt máy móc mỗi 500 ký tự (Fixed Chunking), trong các bài viết kỹ thuật chứa cấu trúc code, ta áp dụng <strong>Recursive Markdown/HTML Chunking</strong>:</p>

<pre><code class="language-python">def chunk_technical_article(text: str, chunk_size: int = 400, overlap: int = 60) -> list[str]:
    \"\"\"
    Chia nhỏ bài viết kỹ thuật theo ranh giới đoạn văn và từ ngữ logic.
    Bảo tồn tính toàn vẹn của mã nguồn và tiêu đề chuyên mục.
    \"\"\"
    words = text.split()
    if not words:
        return []
    
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_content = " ".join(words[start:end])
        chunks.append(chunk_content)
        if end == len(words):
            break
        # Dịch chuyển cửa sổ với độ gối đầu (overlap) để không bị đứt đoạn tư duy giữa các chunk
        start += chunk_size - overlap
    return chunks
</code></pre>

<p>Độ gối đầu (<em>overlap = 60 words</em>) là chìa khóa then chốt: Nó đảm bảo các câu văn mang ý nghĩa chuyển tiếp ở cuối đoạn trước không bị ngắt cụt khi bước sang đoạn sau.</p>

<h2>4. Vector Space &amp; Embedding: Bản chất toán học của sự thấu hiểu ngữ nghĩa</h2>

<p>Làm sao máy tính hiểu được rằng từ <em>"FastAPI"</em> và <em>"Asynchronous Web Framework"</em> có liên quan mật thiết với nhau? Đó là nhờ không gian vector nhiều chiều (High-dimensional Vector Space).</p>

<p>Mô hình Embedding (ví dụ <code>gemini-embedding-001</code> với 768 chiều) chuyển đổi mỗi chuỗi văn bản thành một vector tọa độ trong không gian ℝ<sup>768</sup>. Khi đó, độ tương đồng ngữ nghĩa giữa hai văn bản được đo lường bằng góc giữa hai vector qua công thức <strong>Cosine Similarity</strong>:</p>

<pre><code>Cosine Similarity = (A · B) / (||A|| * ||B||)</code></pre>

<p>Khi các vector được chuẩn hóa về độ dài bằng 1 (L2 Normalization), tích vô hướng (Dot Product) chính là Cosine Similarity. Khoảng cách Euclidean L2 càng nhỏ, hai đoạn văn càng có nội dung tương đồng.</p>

<h3>Kỹ thuật Caching Embeddings: Tối ưu chi phí &amp; Triệt tiêu Rate-Limit</h3>
<p>Một bài toán hóc búa khi vận hành RAG là chi phí gọi API Embedding và ngưỡng giới hạn tốc độ (Rate Limit, ví dụ 15 RPM ở gói Free Tier). Tại HungPH.Blog, chúng tôi xây dựng cơ chế <strong>Hash-based Embedding Cache</strong>:</p>

<ul>
    <li>Mỗi chunk văn bản được băm (hash) bằng SHA-256.</li>
    <li>Trước khi gọi API Gemini, hệ thống tra cứu bảng băm trong bộ nhớ đệm (Pickle/Redis).</li>
    <li>Chỉ những bài viết mới hoặc đoạn văn vừa chỉnh sửa mới tiêu tốn request API. Khi re-index toàn bộ blog, 95% vectors được tải tức thì trong chưa đầy <strong>0.05 giây</strong>!</li>
</ul>

<h2>5. Cuộc chiến Vector Store: Tại sao chúng tôi chọn FAISS Flat L2 cho Blog?</h2>

<p>Hiện nay có vô số lựa chọn lưu trữ Vector: Pinecone, Qdrant, Weaviate, Milvus, pgvector, FAISS. Đâu là quyết định kiến trúc thông minh nhất?</p>

<table>
    <thead>
        <tr>
            <th>Công nghệ</th>
            <th>Loại hình</th>
            <th>Chi phí hạ tầng</th>
            <th>Độ trễ P99</th>
            <th>Khuyên dùng khi</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>FAISS (Facebook AI)</strong></td>
            <td>In-Memory Library (C++)</td>
            <td>$0 (Chạy trong app process)</td>
            <td>&lt; 5ms</td>
            <td>Dưới 500,000 vectors, tối ưu chi phí &amp; deploy gọn nhẹ</td>
        </tr>
        <tr>
            <td><strong>pgvector (PostgreSQL)</strong></td>
            <td>Database Extension</td>
            <td>Dùng chung Postgres</td>
            <td>15ms - 40ms</td>
            <td>Hệ thống sẵn PostgreSQL, cần ACID &amp; filter theo bảng quan hệ</td>
        </tr>
        <tr>
            <td><strong>Pinecone / Qdrant</strong></td>
            <td>Dedicated Cloud Vector DB</td>
            <td>$70 - $300+/tháng</td>
            <td>30ms - 80ms (qua mạng)</td>
            <td>Hàng chục triệu vectors, cần multi-tenant phân tán</td>
        </tr>
    </tbody>
</table>

<p>Với quy mô một blog kỹ thuật cá nhân (khoảng vài trăm đến vài ngàn bài viết và hàng chục ngàn chunks), việc thuê riêng một cụm Pinecone hay dựng cụm Milvus cồng kềnh là <em>Over-engineering</em> lãng phí.</p>

<p><strong>Kiến trúc tinh gọn của HungPH.Blog:</strong> Chúng tôi tích hợp trực tiếp thư viện <strong>FAISS Flat Index</strong> viết bằng C++ biên dịch vào tiến trình Python FastAPI. Toàn bộ index vector được nạp trực tiếp vào RAM. Khi người dùng bấm hỏi, thuật toán quét đối chiếu vector mất chưa đầy <strong>2 miligiây</strong>, hoàn toàn zero chi phí hạ tầng bổ sung.</p>

<h2>6. Post-Retrieval: Deduplication &amp; Hóa giải hội chứng "Lost in the Middle"</h2>

<p>Nghiên cứu của Đại học Stanford chỉ ra rằng: Các mô hình ngôn ngữ lớn xử lý thông tin ở <strong>đầu</strong> và <strong>cuối</strong> prompt tốt hơn hẳn so với những thông tin bị kẹp ở <strong>giữa</strong> (hội chứng <em>Lost in the Middle</em>).</p>

<p>Ngoài ra, nếu trong Top-5 chunks trả về đều rơi vào cùng một bài viết dài, người dùng sẽ nhận được góc nhìn phiến diện. Bộ lọc Post-Retrieval của chúng tôi áp dụng 2 kỹ thuật then chốt:</p>

<ol>
    <li><strong>Document Deduplication (Khử trùng lặp tài liệu):</strong> Duyệt danh sách Top-K theo độ tương đồng, chỉ chọn lọc đoạn văn mang điểm số cao nhất của mỗi bài viết. Nhờ đó, context gửi cho LLM bao quát tri thức từ nhiều bài giảng và chuyên đề khác nhau trên blog.</li>
    <li><strong>Context Reordering (Đảo thứ tự ngữ cảnh):</strong> Đặt đoạn trích có điểm tương đồng cao nhất lên vị trí đầu tiên, đoạn cao thứ hai ở vị trí cuối cùng, các đoạn phụ trợ ở giữa để tối đa hóa sự tập trung của cơ chế Self-Attention trong transformer.</li>
</ol>

<h2>7. Prompt Engineering Chống Ảo Giác (Anti-Hallucination Guardrails)</h2>

<p>Prompt gửi tới LLM đóng vai trò như bản "hợp đồng cam kết". Để mô hình không suy diễn lung tung, System Prompt cần được thiết kế với tính kỷ luật cực cao:</p>

<pre><code class="language-markdown">Bạn là trợ lý AI chuyên môn cao của blog kỹ thuật HungPH.Blog (chuyên gia Backend, System Design và AI/ML).

DƯỚI ĐÂY LÀ DỮ LIỆU THỰC TẾ TRÍCH XUẤT TỪ KHO BÀI VIẾT CỦA BLOG:
---------------------
{context_chunks}
---------------------

QUY TẮC PHẢN HỒI BẮT BUỘC:
1. Chỉ sử dụng thông tin có trong đoạn trích dữ liệu ở trên để trả lời.
2. Tuyệt đối không tự suy diễn hoặc bịa đặt thông tin không có trong tài liệu.
3. Nếu dữ liệu trên không chứa câu trả lời, hãy nói lịch sự: "Nội dung bài viết trên blog chưa đề cập trực tiếp đến vấn đề này, bạn có thể tham khảo thêm các bài viết liên quan hoặc đặt câu hỏi khác."
4. Định dạng câu trả lời bằng Markdown rõ ràng, chuyên nghiệp, giải thích bản chất kỹ thuật một cách dễ hiểu.
</code></pre>

<h2>8. Đo lường &amp; Đánh giá chất lượng RAG bằng RAGAS Framework</h2>

<p>Làm sao bạn biết hệ thống RAG của mình hoạt động tốt hay dở sau mỗi lần thay đổi chunk size hay đổi mô hình embedding? Câu trả lời là bộ 4 chỉ số vàng của <strong>RAG Triad &amp; RAGAS</strong>:</p>

<ul>
    <li><strong>Faithfulness (Tính trung thực):</strong> Câu trả lời có bám sát 100% ngữ cảnh được cung cấp không, hay bịa thêm thông tin ngoài?</li>
    <li><strong>Answer Relevance (Mức độ liên quan của câu trả lời):</strong> Câu trả lời có giải quyết trúng đích thắc mắc ban đầu của người dùng không?</li>
    <li><strong>Context Precision (Độ chuẩn xác của ngữ cảnh):</strong> Các đoạn trích dẫn đứng đầu có thực sự liên quan hơn các đoạn trích phía sau?</li>
    <li><strong>Context Recall (Độ bao phủ của ngữ cảnh):</strong> Hệ thống có truy xuất đủ toàn bộ các mẩu thông tin cần thiết để giải quyết câu hỏi không?</li>
</ul>

<h2>9. Trải nghiệm thực tế: Hãy thử thách RAG Engine ngay trên Blog!</h2>

<p>Lý thuyết hay nhất là lý thuyết có thể kiểm chứng được ngay lập tức bằng mã nguồn và sản phẩm thực tế.</p>

<p>Hệ thống RAG mà bạn vừa đọc trong bài viết này đang chạy 24/7 trực tiếp trên website. Bạn có thể bấm ngay vào tính năng <strong><a href="/rag">Trợ lý AI (RAG Assistant)</a></strong> trên thanh menu điều hướng và thử đặt những câu hỏi chuyên sâu như:</p>

<ul>
    <li><em>"Kiến trúc Modular Monolith trong FastAPI được thiết kế ra sao trên blog này?"</em></li>
    <li><em>"Tại sao hệ thống lại kết hợp SQLite với FAISS thay vì dựng pgvector ngay từ đầu?"</em></li>
    <li><em>"Luồng xử lý chống rate limit của Gemini Embedding hoạt động như thế nào?"</em></li>
</ul>

<p>Hãy tự mình trải nghiệm tốc độ suy luận, độ chính xác của câu trả lời cùng nguồn trích dẫn minh bạch. Nếu bạn có bất kỳ thắc mắc hoặc ý tưởng nào để tối ưu hóa pipeline RAG này hơn nữa, đừng ngần ngại để lại bình luận ở khung thảo luận ngay bên dưới nhé!</p>"""

        if existing_rag_post:
            existing_rag_post.title = rag_title
            existing_rag_post.summary = rag_summary
            existing_rag_post.content_html = rag_content
            existing_rag_post.reading_time_minutes = 18
            existing_rag_post.is_spotlight = True
            await db.commit()
        else:
            stmt_cat = select(Category).where(Category.slug == "ky-thuat-cong-nghe")
            cat_res = await db.execute(stmt_cat)
            cat_tech = cat_res.scalar_one_or_none()
            rag_article = Post(
                title=rag_title,
                slug="kien-truc-rag-retrieval-augmented-generation-cua-blog",
                summary=rag_summary,
                content_html=rag_content,
                cover_image="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&w=1200&q=80",
                is_published=True,
                is_spotlight=True,
                reading_time_minutes=18,
                author_id=admin.id if admin else None,
                category_id=cat_tech.id if cat_tech else None,
            )
            db.add(rag_article)
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
app.include_router(social_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)


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
