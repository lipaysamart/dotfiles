#!/bin/bash
set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${BLUE:=\033[0;34m}"
: "${RED:=\033[0;31m}"
: "${NC:=\033[0m}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_skip() {
    echo -e "${BLUE}[SKIP]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

ensure_path() {
    local uv_bin="$HOME/.local/bin"
    if [[ -d "$uv_bin" ]] && [[ ":$PATH:" != *":$uv_bin:"* ]]; then
        export PATH="$uv_bin:$PATH"
    fi
}

main() {
    ensure_path

    if check_command uv; then
        log_skip "uv 已安装: $(uv --version 2>/dev/null || echo '已安装')"
        exit 0
    fi

    log_info "开始安装 uv (Astral 的 Python 包管理器)..."

    if ! check_command curl && ! check_command wget; then
        log_error "未找到 curl 或 wget，请先安装其中之一"
        exit 1
    fi

    if check_command curl; then
        curl -fsSL https://astral.sh/uv/install.sh | sh
    else
        wget -qO- https://astral.sh/uv/install.sh | sh
    fi

    ensure_path

    if check_command uv; then
        log_info "uv 安装成功: $(uv --version)"
    else
        log_error "uv 安装失败，请检查日志或手动安装: https://docs.astral.sh/uv/getting-started/installation/"
        exit 1
    fi
}

main "$@"