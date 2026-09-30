---
name: deploy
description: Deploy project hungph-blog lên production. Trigger duy nhất là git push origin main — Vercel và Render tự build.
---

# Deploy Skill (project-level override)

## [C-001] Gate bắt buộc: Chạy test trước khi deploy

**KHÔNG được deploy nếu chưa chạy test và chưa xác nhận tất cả pass.**

1. Đọc `test_command_backend` từ CLAUDE.md → chạy pytest
2. Đọc `test_command_frontend` từ CLAUDE.md → chạy jest (nếu đã có)
3. Kiểm tra exit code:
   - Tất cả = 0 → được phép tiếp tục deploy
   - Bất kỳ ≠ 0 → **ABORT ngay**, báo Orchestrator/Human, KHÔNG deploy
4. Không được bỏ qua bước này dù có lý do gì

## Deploy

**Trigger duy nhất:** `git push origin main`
- Vercel nhận webhook → build và deploy frontend tự động
- Render nhận webhook → build và deploy backend tự động

**Không dùng** `vercel --prod`, `vercel deploy`, hay bất kỳ lệnh deploy riêng nào.

### Quy trình

1. Chạy test gate (C-001) ở trên
2. Stage các file đã thay đổi: `git add <files>`
3. Commit với message chuẩn
4. Push: `git push origin main`
5. Theo dõi build log trên Vercel/Render dashboard (nếu có access)

## Guardrails
- Không deploy production nếu không có explicit approval từ Orchestrator/Human
- Không deploy production nếu còn test đang fail (C-001)
- Không tự rollback production — báo Human nếu deploy fail
- Không dùng `git push --force` lên main
