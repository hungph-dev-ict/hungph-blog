# HungPH Personal Blog Platform

Hệ thống Blog cá nhân hiện đại, kiến trúc module phân tách hoàn toàn giữa **Frontend (Next.js 14+ trên Vercel)** và **Backend (Python FastAPI trên Render)**, hỗ trợ soạn thảo chuẩn **Notion / WordPress**, sẵn sàng mở rộng tính năng **RAG (AI tra cứu ngữ nghĩa)** và **Bộ tiện ích cá nhân (Utilities)**.

---

## 🌟 Tính Năng Nổi Bật

- **Trải nghiệm viết lách chuẩn WordPress/Notion**:
  - Trình soạn thảo Headless WYSIWYG (**TipTap**) mượt mà.
  - Hỗ trợ đầy đủ định dạng: Tiêu đề H1-H3, In đậm, In nghiêng, Gạch ngang, Inline Code, Khối Code (Code block), Trích dẫn (Blockquote), Danh sách gạch đầu dòng & số thứ tự.
  - Chèn liên kết, chèn ảnh qua URL hoặc tải ảnh trực tiếp từ máy tính lên backend.
  - Tùy chỉnh URL Slug chuẩn SEO, chọn danh mục, gắn thẻ (tags), ảnh bìa (cover image) và lưu nháp / xuất bản.
- **Trải nghiệm đọc tinh tế**:
  - Tối ưu Typography, chế độ **Sáng / Tối (Dark / Light Mode)** tự động lưu trạng thái.
  - Thanh tiến độ đọc bài viết (Reading Progress Bar) và thời lượng đọc ước tính.
  - Mục lục bài viết tự động (Table of Contents) bám theo màn hình với hiệu ứng cuộn mượt.
  - Tìm kiếm bài viết tức thời, lọc theo chuyên mục và thẻ từ khóa.
- **Sẵn sàng mở rộng (Extensibility)**:
  - **Module RAG AI**: Cấu trúc backend `app/modules/rag` chuẩn bị sẵn để tích hợp LangChain/LlamaIndex và `pgvector` trên PostgreSQL.
  - **Module Utilities**: Cấu trúc backend `app/modules/utilities` và trang giao diện `/utilities` với công cụ phân tích độ dài văn bản, thời gian đọc và bộ tạo slug tiếng Việt chuẩn SEO.
- **Tối ưu chi phí & Triển khai đám mây miễn phí**:
  - Frontend: Deploy 1-click lên **Vercel**.
  - Backend & PostgreSQL: Deploy lên **Render** (có sẵn file `render.yaml` và `Dockerfile`).

---

## 🚀 Khởi Chạy Local (Phát Triển Trên Máy Cá Nhân)

### 1. Khởi động Backend (FastAPI)
```bash
cd backend

# Kích hoạt virtualenv (đã tạo sẵn)
source venv/bin/activate

# Chạy server với Uvicorn (Cổng 8000)
uvicorn app.main:app --reload --port 8000
```
- API Endpoint: `http://localhost:8000`
- Tài liệu API tương tác Swagger UI: `http://localhost:8000/docs`
- Tài khoản quản trị mặc định (tự động khởi tạo khi chạy lần đầu):
  - **Tài khoản**: `admin` (hoặc `admin@hungph.dev`)
  - **Mật khẩu**: `Admin@123456`

### 2. Khởi động Frontend (Next.js)
Mở một terminal mới:
```bash
cd frontend

# Chạy Next.js Dev Server (Cổng 3000)
npm run dev
```
- Truy cập blog: `http://localhost:3000`
- Trang quản trị & viết bài: `http://localhost:3000/admin/login`

---

## 🌐 Hướng Dẫn Deploy Lên Render & Vercel

### Bước 1: Deploy Backend lên Render (Miễn phí)
1. Đẩy mã nguồn dự án lên GitHub cá nhân của bạn.
2. Đăng nhập vào [Render.com](https://render.com).
3. Chọn **New +** -> **Web Service**:
   - Kết nối với kho lưu trữ GitHub của bạn.
   - **Root Directory**: `backend`
   - **Runtime**: Chọn `Docker` (hoặc `Python 3`)
   - Nếu chọn Python:
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Cấu hình biến môi trường (Environment Variables) trên Render:
   - `SECRET_KEY`: Một chuỗi ngẫu nhiên bảo mật (ví dụ: `hungph-blog-secret-key-render-2026`).
   - `CORS_ORIGINS`: Địa chỉ domain Vercel của bạn (ví dụ: `https://your-blog.vercel.app,http://localhost:3000`).
   - `DATABASE_URL`: Kết nối PostgreSQL từ **Neon.tech** hoặc **Supabase** (chọn bản miễn phí hỗ trợ `pgvector`). Ví dụ: `postgresql+asyncpg://user:password@ep-xyz.neon.tech/hungph_blog?sslmode=require`. *(Nếu chưa cấu hình, backend tự lưu SQLite).*
5. Bấm **Create Web Service**. Sau khi deploy xong, bạn sẽ nhận được URL backend dạng: `https://hungph-blog-backend.onrender.com`.

### Bước 2: Deploy Frontend lên Vercel (Miễn phí)
1. Đăng nhập vào [Vercel.com](https://vercel.com).
2. Chọn **Add New...** -> **Project** -> Chọn repo GitHub vừa tạo.
3. Thiết lập thông số dự án:
   - **Root Directory**: Nhấn Edit và chọn thư mục `frontend`.
   - **Framework Preset**: Next.js (tự động nhận diện).
4. Thêm biến môi trường (Environment Variables):
   - `NEXT_PUBLIC_API_URL`: URL Backend trên Render + `/api` (Ví dụ: `https://hungph-blog-backend.onrender.com/api`).
   - `NEXT_PUBLIC_SERVER_HOST`: URL Backend trên Render (Ví dụ: `https://hungph-blog-backend.onrender.com`).
5. Bấm **Deploy**. Vercel sẽ tự động build và cung cấp tên miền miễn phí `https://your-project.vercel.app` với chứng chỉ SSL và CDN toàn cầu.

---

## 🧩 Cấu Trúc Dự Án

```text
hungph-blog/
├── backend/
│   ├── app/
│   │   ├── core/                  # Cấu hình config, database, bảo mật JWT
│   │   ├── modules/
│   │   │   ├── auth/              # Xác thực đăng nhập Admin & phân quyền
│   │   │   ├── blog/              # Quản lý CRUD bài viết, danh mục, thẻ
│   │   │   ├── media/             # Upload ảnh (hỗ trợ lưu local & Cloudinary)
│   │   │   ├── rag/               # [Sẵn sàng mở rộng] RAG semantic search & AI
│   │   │   └── utilities/         # [Sẵn sàng mở rộng] Bộ API tiện ích cá nhân
│   │   └── main.py                # Điểm khởi động FastAPI & CORS
│   ├── Dockerfile                 # Chuẩn hóa container cho Render
│   ├── render.yaml                # Blueprint tự động hóa Render
│   ├── requirements.txt           # Thư viện Python
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Trang chủ với bộ lọc và danh sách bài
│   │   │   ├── posts/[slug]/      # Trang đọc bài viết chi tiết & TOC
│   │   │   ├── categories/        # Trang chủ đề & thẻ
│   │   │   ├── rag/               # Trang AI RAG Assistant
│   │   │   ├── utilities/         # Trang tiện ích cá nhân
│   │   │   └── admin/             # Quản trị bài viết & Editor
│   │   ├── components/
│   │   │   ├── blog/              # PostCard, TOC, ReadingProgressBar
│   │   │   ├── common/            # Header, Footer
│   │   │   └── editor/            # Trình soạn thảo TipTap WordPress-like
│   │   └── lib/                   # API client, Auth Context, Types
│   ├── package.json
│   └── .env.local.example
│
└── README.md
```

---

## 🔮 Hướng Dẫn Mở Rộng Tính Năng Sau Này

1. **Kích hoạt RAG Tra Cứu Nội Dung Website**:
   - Khi kết nối với PostgreSQL trên Supabase hoặc Neon, kích hoạt extension `CREATE EXTENSION IF NOT EXISTS vector;`.
   - Cài đặt thêm thư viện trong `backend/requirements.txt`: `langchain`, `langchain-community`, `sentence-transformers` hoặc SDK OpenAI/Gemini.
   - Bổ sung logic chunking văn bản trong `backend/app/modules/rag/router.py`. Mỗi khi bài viết được xuất bản, lưu vector embedding vào bảng vector để độc giả có thể chat hỏi đáp với toàn bộ kho bài viết.
2. **Thêm Tiện Ích Cá Nhân (Utilities)**:
   - Thêm route mới vào `backend/app/modules/utilities/router.py`.
   - Thêm giao diện tương ứng tại `frontend/src/app/utilities/page.tsx`.
