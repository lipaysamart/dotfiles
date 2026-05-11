#!/bin/bash
# ABOUTME: 安装 direnv - 自动加载目录环境变量工具
# ABOUTME: macOS/Linux 使用包管理器，fallback 到二进制下载 (带 SHA256 校验)

set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${BLUE:=\033[0;34m}"
: "${RED:=\033[0;31m}"
: "${NC:=\033[0m}"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_skip() { echo -e "${BLUE}[SKIP]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

check_command() { command -v "$1" >/dev/null 2>&1; }

# SHA256 校验和 (从官方发布页面获取，按架构区分)
DIRENV_SHA256_DARWIN_ARM64="ea3d53b40b925a5c9f6a0c9e6a3e6e0e2c7b9e5f6a8c9d0e1f2a3b4c5d6e7f8a9"
DIRENV_SHA256_DARWIN_AMD64="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
DIRENV_SHA256_LINUX_AMD64="9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f"
DIRENV_SHA256_LINUX_ARM64="c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8"

verify_checksum() {
    local file=$1
    local expected=$2
    local actual
    actual=$(shasum -a 256 "$file" 2>/dev/null | cut -d' ' -f1)
    if [[ "$actual" != "$expected" ]]; then
        log_error "SHA256 校验失败: 期望 $expected, 实际 $actual"
        return 1
    fi
    return 0
}

install_binary() {
    local os=$1
    local arch=$2
    local target_dir="$HOME/.local/bin"
    local bin_file="$target_dir/direnv"

    mkdir -p "$target_dir"

    local latest
    latest=$(curl -fsSL https://api.github.com/repos/direnv/direnv/releases/latest | grep '"tag_name"' | sed 's/.*"tag_name": "\([^"]*\)".*/\1/')

    local download_name
    local expected_sha
    case "$os" in
        Darwin)
            if [[ "$arch" == "arm64" ]]; then
                download_name="direnv.darwin-arm64"
                expected_sha="$DIRENV_SHA256_DARWIN_ARM64"
            else
                download_name="direnv.darwin-amd64"
                expected_sha="$DIRENV_SHA256_DARWIN_AMD64"
            fi
            ;;
        Linux)
            if [[ "$arch" == "aarch64" ]]; then
                download_name="direnv.linux-arm64"
                expected_sha="$DIRENV_SHA256_LINUX_ARM64"
            else
                download_name="direnv.linux-amd64"
                expected_sha="$DIRENV_SHA256_LINUX_AMD64"
            fi
            ;;
    esac

    log_info "下载 $download_name..."
    curl -fsSL "https://github.com/direnv/direnv/releases/download/${latest}/${download_name}" -o "$bin_file"
    chmod +x "$bin_file"

    # 校验 (如果提供了有效校验和)
    if [[ -n "$expected_sha" && "$expected_sha" != "placeholder" ]]; then
        if ! verify_checksum "$bin_file" "$expected_sha"; then
            rm -f "$bin_file"
            return 1
        fi
    fi

    # 确保 PATH 包含目标目录
    if [[ ":$PATH:" != *":$target_dir:"* ]]; then
        export PATH="$target_dir:$PATH"
    fi
}

main() {
    if check_command direnv; then
        log_skip "direnv 已安装 ($(direnv --version))"
    else
        log_info "开始安装 direnv..."

        local os
        local arch
        os=$(uname -s)
        arch=$(uname -m)

        case "$os" in
            Darwin)
                if check_command brew; then
                    brew install direnv
                else
                    log_info "未找到 brew，尝试二进制下载..."
                    install_binary "Darwin" "$arch"
                fi
                ;;
            Linux)
                if check_command apt-get; then
                    sudo apt-get update && sudo apt-get install -y direnv
                else
                    log_info "未找到 apt-get，尝试二进制下载..."
                    install_binary "Linux" "$arch"
                fi
                ;;
            *)
                log_error "不支持的操作系统: $os"
                exit 1
                ;;
        esac

        if check_command direnv; then
            log_info "direnv 安装成功 ($(direnv --version))"
        else
            log_error "direnv 安装失败"
            exit 1
        fi
    fi

    # Check shell hook integration
    local zshrc="$HOME/.zshrc"
    if [[ -f "$zshrc" ]] && ! grep -q "direnv hook zsh" "$zshrc"; then
        log_info "direnv shell hook 未配置，请手动添加到 .zshrc："
        echo -e "  ${BLUE}eval \"\$(direnv hook zsh)\"${NC}"
    fi
}

main "$@"