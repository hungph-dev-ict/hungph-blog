#!/usr/bin/env bash

# ==============================================================================
# HungPH Blog - Local Development Startup Script
# Khởi chạy đồng thời cả Backend (FastAPI) và Frontend (Next.js)
# ==============================================================================

set -e

# Đường dẫn thư mục gốc
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Màu hiển thị terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${PURPLE}${BOLD}======================================================${NC}"
echo -e "${CYAN}${BOLD}       🚀 KHỞI ĐỘNG HỆ THỐNG HUNGPH BLOG LOCAL         ${NC}"
echo -e "${PURPLE}${BOLD}======================================================${NC}"
echo ""

# ------------------------------------------------------------------------------
# 1. Kiểm tra môi trường Backend (Python & Virtualenv)
# ------------------------------------------------------------------------------
VENV_PYTHON=""
if [ -f "$BACKEND_DIR/venv/bin/python" ]; then
    VENV_PYTHON="$BACKEND_DIR/venv/bin/python"
elif [ -f "$BACKEND_DIR/.venv/bin/python" ]; then
    VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
else
    echo -e "${YELLOW}⚠️  Không tìm thấy virtual environment ở backend/venv.${NC}"
    echo -e "   Đang khởi tạo venv mới..."
    python3 -m venv "$BACKEND_DIR/venv"
    VENV_PYTHON="$BACKEND_DIR/venv/bin/python"
    echo -e "   Đang cài đặt thư viện từ requirements.txt..."
    "$VENV_PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

# ------------------------------------------------------------------------------
# 2. Kiểm tra môi trường Frontend (Node & node_modules)
# ------------------------------------------------------------------------------
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Chưa cài đặt node_modules ở frontend.${NC}"
    echo -e "   Đang chạy npm install..."
    (cd "$FRONTEND_DIR" && npm install)
fi

# ------------------------------------------------------------------------------
# 3. Kiểm tra trùng Port (8000 và 3000)
# ------------------------------------------------------------------------------
check_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo -e "${RED}⚠️  Cổng $port ($name) đang bị chiếm bởi PID: $pid${NC}"
        echo -ne "   Bạn có muốn giải phóng cổng $port ngay bây giờ? (y/N): "
        read -r ans
        if [[ "$ans" =~ ^[Yy]$ ]]; then
            kill -9 $pid 2>/dev/null || true
            echo -e "${GREEN}   ✓ Đã giải phóng cổng $port.${NC}"
        else
            echo -e "${RED}   Vui lòng tắt ứng dụng đang dùng cổng $port trước khi chạy.${NC}"
            exit 1
        fi
    fi
}

check_port 8000 "Backend FastAPI"
check_port 3000 "Frontend Next.js"

# ------------------------------------------------------------------------------
# 4. Quản lý dừng tiến trình khi bấm Ctrl+C (Graceful Shutdown)
# ------------------------------------------------------------------------------
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Đang dừng toàn bộ dịch vụ...${NC}"
    
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    # Đảm bảo không còn process ngầm
    sleep 0.5
    local lingering_backend=$(lsof -ti :8000 2>/dev/null || true)
    if [ -n "$lingering_backend" ]; then
        kill -9 $lingering_backend 2>/dev/null || true
    fi
    local lingering_frontend=$(lsof -ti :3000 2>/dev/null || true)
    if [ -n "$lingering_frontend" ]; then
        kill -9 $lingering_frontend 2>/dev/null || true
    fi

    echo -e "${GREEN}✅ Đã tắt Frontend & Backend an toàn. Hẹn gặp lại!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ------------------------------------------------------------------------------
# 5. Khởi động Backend (FastAPI - Port 8000)
# ------------------------------------------------------------------------------
echo -e "${BLUE}▶ Đang khởi động Backend FastAPI (Port 8000)...${NC}"
(
    cd "$BACKEND_DIR"
    exec "$VENV_PYTHON" -m uvicorn app.main:app --reload --port 8000
) &
BACKEND_PID=$!

# Đợi 1 giây để backend khởi tạo
sleep 1

# ------------------------------------------------------------------------------
# 6. Khởi động Frontend (Next.js - Port 3000)
# ------------------------------------------------------------------------------
echo -e "${GREEN}▶ Đang khởi động Frontend Next.js (Port 3000)...${NC}"
(
    cd "$FRONTEND_DIR"
    exec npm run dev
) &
FRONTEND_PID=$!

# ------------------------------------------------------------------------------
# 7. Thông báo hoàn tất và các đường dẫn hữu ích
# ------------------------------------------------------------------------------
sleep 1.5
echo ""
echo -e "${GREEN}${BOLD}✨ Hệ thống đã sẵn sàng phục vụ!${NC}"
echo -e "   • ${BOLD}Trang chủ Blog:${NC}     ${CYAN}http://localhost:3000${NC}"
echo -e "   • ${BOLD}Trang Quản trị:${NC}     ${CYAN}http://localhost:3000/admin/login${NC}"
echo -e "   • ${BOLD}Tài liệu API Docs:${NC}  ${CYAN}http://localhost:8000/docs${NC}"
echo -e "   • ${BOLD}API Base URL:${NC}       ${CYAN}http://localhost:8000/api${NC}"
echo ""
echo -e "${YELLOW}Nhấn ${BOLD}Ctrl + C${NC}${YELLOW} để dừng cả hai máy chủ cùng lúc.${NC}"
echo -e "${PURPLE}------------------------------------------------------${NC}"
echo ""

# Chờ cả 2 tiến trình con
wait
