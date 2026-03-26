#!/bin/bash
set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${BLUE:=\033[0;34m}"
: "${RED:=\033[0;31m}"
: "${NC:=\033[0m}"
: "${OS:=$(uname)}"

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
    local pipx_bin="$HOME/.local/bin"
    if [[ ":$PATH:" != *":$pipx_bin:"* ]]; then
        log_info "将 $pipx_bin 添加到 PATH"
        export PATH="$pipx_bin:$PATH"
    fi
}

install_via_pip() {
    log_info "通过 pip 安装 pipx..."
    if check_command pip3; then
        pip3 install --user pipx
    elif check_command pip; then
        pip install --user pipx
    else
        log_error "未找到 pip 或 pip3"
        return 1
    fi
}

install_via_brew() {
    log_info "通过 Homebrew 安装 pipx..."
    brew install pipx
    if [[ -f "$(brew --prefix)/opt/pipx/bin/pipx" ]]; then
        log_info "确保 pipx 符号链接正确..."
        brew link pipx 2>/dev/null || true
    fi
}

install_via_apt() {
    log_info "通过 apt 安装 pipx..."
    sudo apt-get update
    sudo apt-get install -y pipx
}

main() {
    ensure_path

    if check_command pipx; then
        log_skip "pipx 已安装: $(pipx --version)"
        exit 0
    fi

    log_info "开始安装 pipx..."

    if ! check_command python3 && ! check_command python; then
        log_error "未找到 Python，请先安装 Python 3"
        exit 1
    fi

    case "$OS" in
        Darwin)
            if check_command brew; then
                install_via_brew
            else
                install_via_pip
            fi
            ;;
        Linux)
            if check_command apt-get; then
                install_via_apt
            elif check_command dnf; then
                log_info "通过 dnf 安装 pipx..."
                sudo dnf install -y pipx
            elif check_command pacman; then
                log_info "通过 pacman 安装 pipx..."
                sudo pacman -Sy --noconfirm python-pipx
            else
                install_via_pip
            fi
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac

    ensure_path

    if check_command pipx; then
        pipx ensurepath 2>/dev/null || true
        log_info "pipx 安装成功: $(pipx --version)"
    else
        log_error "pipx 安装失败"
        exit 1
    fi
}

main "$@"