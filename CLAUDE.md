# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# hungph-blog — AI-DLC Config

## Project
- Name: HungPH Personal Blog Platform
- Repo: https://github.com/hungph-dev-ict/hungph-blog
- Description: Blog platform full-stack — Frontend Next.js trên Vercel, Backend Python FastAPI trên Render

## Architecture
Full-stack monorepo — 2 stack riêng biệt:
- `frontend/` — Next.js (App Router, React 19), deploy Vercel
- `backend/`  — Python FastAPI, deploy Render

Khi nhận task, Developer Agent phải xác định rõ task thuộc frontend, backend, hay cả 2.

## Tech Stack

### Frontend (frontend/)
- **Framework**: Next.js 16 + React 19, TypeScript 5
- **Styling**: Tailwind CSS v4 (no config file — uses `@tailwindcss/postcss`)
- **Rich text editor**: Tiptap v3 (`@tiptap/react`, starter-kit + image/link/placeholder/table extensions)
- **Auth**: Custom React context at `src/lib/auth-context.tsx` — JWT stored client-side, no NextAuth
- **API client**: Custom `src/lib/api.ts` — no React Query or SWR
- **State**: React context only (`auth-context.tsx`, `loading-context.tsx`)
- **Icons**: `lucide-react`
- **Deploy**: Vercel (auto-deploy on push to main)
- **Local**: port 3000

### Backend (backend/)
- **Framework**: FastAPI + Uvicorn
- **ORM**: SQLAlchemy 2.0 async (`asyncpg` for PostgreSQL, `aiosqlite` for SQLite)
- **Database**: SQLite locally (`blog.db`), PostgreSQL (Supabase) in production
- **Auth**: Custom JWT (`pyjwt` + `bcrypt`) — no OAuth
- **Media**: Cloudinary (`cloudinary` SDK)
- **AI/RAG**: Google Generative AI + FAISS (`google-generativeai`, `faiss-cpu`)
- **Middleware**: `AuditLogMiddleware` logs all requests
- **Static files**: `/uploads` mount
- **Deploy**: Render (auto-deploy on push to main)
- **Local**: port 8000

## Commands

### Local dev (both stacks)
```bash
./run.sh
```
Starts backend (port 8000) + frontend (port 3000). URLs:
- Blog: http://localhost:3000
- Admin: http://localhost:3000/admin/login
- API docs: http://localhost:8000/docs

### Frontend only
```bash
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint
cd frontend && npm test                   # Jest (ts-jest)
cd frontend && npm run test:watch
```
Run a single test file:
```bash
cd frontend && npx jest src/__tests__/fetchUserBookmarks.test.ts
```

### Backend only
```bash
cd backend && uvicorn app.main:app --reload --port 8000
```
Run tests:
```bash
cd backend && pytest tests/
cd backend && pytest tests/test_bookmarks_pagination.py   # single file
```

## Environment Setup

### Backend
Copy `backend/.env.example` → `backend/.env` and fill in:
- `SECRET_KEY` — JWT signing key
- `DATABASE_URL` — `sqlite+aiosqlite:///./blog.db` locally, or Supabase PostgreSQL URL
- `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` — seeded on first run
- `CORS_ORIGINS` — comma-separated allowed origins
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `GEMINI_API_KEY` — **not in `.env.example`** but required for the RAG module (Gemini 1.5 Flash + text-embedding-004)

### Frontend
No `.env.example` exists. If `NEXT_PUBLIC_API_URL` is needed, create `frontend/.env.local`.

**TypeScript path alias:** `@/*` → `./src/*` (configured in `tsconfig.json`).

## Backend Module Structure

All modules under `backend/app/modules/`:

| Module | Responsibility |
|---|---|
| `auth/` | JWT login/register, user model, `get_current_user` dependency |
| `blog/` | Posts (CRUD, slugs, series, bookmarks, pagination) |
| `blog/glossary_router.py` | Glossary terms separate from main blog router |
| `media/` | File uploads → Cloudinary |
| `rag/` | AI-powered search (Google Generative AI embeddings + FAISS index) |
| `social/` | Notifications, comments, likes |
| `audit/` | Audit log middleware + query endpoint |
| `utilities/` | Misc helpers |

Core infrastructure: `app/core/config.py` (settings via pydantic-settings), `app/core/database.py` (async session), `app/core/security.py` (JWT helpers).

## Frontend Route Structure

All routes under `frontend/src/app/` (Next.js App Router):

| Route | Description |
|---|---|
| `/` | Home / post list |
| `/posts/[slug]` | Post detail |
| `/posts/manage` | Author post management |
| `/editor/new`, `/editor/[id]` | Tiptap rich text editor |
| `/series`, `/series/[slug]` | Series index and detail |
| `/categories` | Category browser |
| `/profile/[username]` | User profile with posts + bookmarks |
| `/rag` | AI search |
| `/notifications` | User notifications |
| `/utilities` | Utility tools |
| `/admin/*` | Admin panel (login, posts, users, categories, series, glossary, logs, reports) |

## Test Status

- **Frontend**: Jest + ts-jest. Tests in `frontend/src/__tests__/`. Currently 1 test file.
  - `test_command_frontend`: `cd frontend && npm test`
- **Backend**: pytest. Tests in `backend/tests/`. Currently 1 test file.
  - `test_command_backend`: `cd backend && pytest tests/`

## Deploy

**Trigger:** `git push origin main` → Vercel (frontend) and Render (backend) auto-build and deploy.

- Frontend health check: `/`
- Backend health check: `/health` or `/docs`

## Workflow Rules
- Deploy: thẳng lên production (không qua staging)
- Approval: chỉ owner approve trước mọi deploy production
- Branch: main là production branch
- Backend trước, frontend sau khi task cần cả 2 stack

## Constraints

### [C-001] Unit Test bắt buộc trước khi deploy
- Mọi chức năng PHẢI có unit test đi kèm.
- Tester Agent viết test ngay sau khi Developer Agent hoàn thành code.
- **Tất cả test case phải pass 100% mới được phép deploy.**
- Nếu có test fail, Developer Agent phải fix code (không được xoá test để bypass).
- Frontend: Jest/Vitest. Backend: pytest.

Dùng /constraint [mô tả] để thêm constraint bất cứ lúc nào.
