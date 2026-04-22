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

main() {
    if check_command keychain; then
        log_skip "keychain 已安装: $(keychain --version 2>&1 | head -1 || echo '已安装')"
        exit 0
    fi

    log_info "开始安装 keychain (SSH/GPG 密钥代理管理器)..."

    OS=$(uname -s)

    case "$OS" in
        Darwin)
            if check_command brew; then
                brew install keychain
            else
                log_error "未找到 brew，请先安装 Homebrew"
                exit 1
            fi
            ;;
        Linux)
            if check_command apt-get; then
                sudo apt-get update && sudo apt-get install -y keychain
            elif check_command dnf; then
                sudo dnf install -y keychain
            elif check_command pacman; then
                sudo pacman -S --noconfirm keychain
            else
                log_error "未找到支持的包管理器 (apt/dnf/pacman)"
                exit 1
            fi
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac

    if check_command keychain; then
        log_info "keychain 安装成功: $(keychain --version 2>&1 | head -1)"
    else
        log_error "keychain 安装失败，请检查日志或手动安装"
        exit 1
    fi
}

main "$@"