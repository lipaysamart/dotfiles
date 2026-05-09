#!/bin/bash
set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${BLUE:=\033[0;34m}"
: "${RED:=\033[0;31m}"
: "${NC:=\033[0m}"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_skip() { echo -e "${BLUE}[SKIP]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

check_command() { command -v "$1" >/dev/null 2>&1; }

main() {
    if check_command direnv; then
        log_skip "direnv 已安装 ($(direnv --version))"
    else
        log_info "开始安装 direnv..."

        OS=$(uname -s)
        case "$OS" in
            Darwin)
                if check_command brew; then
                    brew install direnv
                else
                    # Fallback: binary download via curl
                    log_info "未找到 brew，尝试二进制下载..."
                    local latest
                    latest=$(curl -fsSL https://api.github.com/repos/direnv/direnv/releases/latest | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)",/\1/')
                    curl -fsSL "https://github.com/direnv/direnv/releases/download/${latest}/direnv.darwin-arm64" -o "$HOME/.local/bin/direnv"
                    chmod +x "$HOME/.local/bin/direnv"
                fi
                ;;
            Linux)
                if check_command apt-get; then
                    sudo apt-get update && sudo apt-get install -y direnv
                else
                    local latest
                    latest=$(curl -fsSL https://api.github.com/repos/direnv/direnv/releases/latest | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)",/\1/')
                    local arch
                    arch=$(uname -m)
                    [[ "$arch" == "x86_64" ]] && arch="amd64"
                    curl -fsSL "https://github.com/direnv/direnv/releases/download/${latest}/direnv.linux-${arch}" -o "$HOME/.local/bin/direnv"
                    chmod +x "$HOME/.local/bin/direnv"
                fi
                ;;
            *)
                log_error "不支持的操作系统: $OS"
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
