# hungph-blog — AI-DLC Config

## Project
- Name: HungPH Personal Blog Platform
- Repo: https://github.com/hungph-dev-ict/hungph-blog
- Description: Blog platform full-stack — Frontend Next.js 14 trên Vercel, Backend Python FastAPI trên Render

## Architecture
Full-stack monorepo — 2 stack riêng biệt:
- `frontend/` — Next.js 14+ (React), deploy Vercel
- `backend/`  — Python FastAPI, deploy Render

Khi nhận task, Developer Agent phải xác định rõ task thuộc frontend, backend, hay cả 2.

## Tech Stack

### Frontend (frontend/)
- Framework: Next.js 14+
- Language: TypeScript / JavaScript
- Deploy: Vercel
- Local: chạy từ `./run.sh` hoặc `cd frontend && npm run dev`

### Backend (backend/)
- Framework: FastAPI (Python)
- Deploy: Render
- Local: chạy từ `./run.sh` hoặc `cd backend && uvicorn main:app --reload`

## Test
- Frontend: chưa có — Tester Agent viết Jest/Vitest khi làm task đầu tiên
- Backend: chưa có — Tester Agent viết pytest khi làm task đầu tiên
- Sau khi có test: cập nhật test_command bên dưới

test_command_frontend: (chưa có — Tester Agent xác định sau)
test_command_backend: (chưa có — Tester Agent xác định sau)

## Deploy

**Trigger duy nhất:** `git push origin main` → Vercel (frontend) và Render (backend) tự động build và deploy.
Không cần chạy `vercel --prod` hay lệnh deploy riêng.

### Frontend
- Target: Vercel (auto-deploy khi push main)
- URL: (điền sau khi biết URL production)
- Health check: / (homepage)

### Backend
- Target: Render (auto-deploy khi push main)
- URL: (điền sau khi biết URL production)
- Health check: /health hoặc /docs

## Workflow Rules
- Deploy: thẳng lên production (không qua staging)
- Approval: chỉ owner (bạn) approve trước mọi deploy production
- Branch: main là production branch

## Developer Agent — hướng dẫn làm việc

Trước khi code, xác định task thuộc phần nào:
- UI, component, page, SEO → frontend/
- API endpoint, database, auth, business logic → backend/
- Cả 2 → làm backend trước (API), frontend sau (consume API)

Không được sửa file của stack còn lại trừ khi task yêu cầu rõ ràng.

## Local dev
```
./run.sh          # start cả frontend (port 3000) + backend (port 8000)
```

## Constraints

### [C-001] Unit Test bắt buộc trước khi deploy
- Mọi chức năng được yêu cầu PHẢI có unit test đi kèm.
- Tester Agent viết test ngay sau khi Developer Agent hoàn thành code.
- **Tất cả test case phải pass 100% mới được phép deploy lên production.**
- Nếu có test fail, Developer Agent phải fix code (không được xoá test để bypass).
- Áp dụng cho cả frontend (Jest/Vitest) và backend (pytest).

Dùng /constraint [mô tả] để thêm constraint bất cứ lúc nào.
