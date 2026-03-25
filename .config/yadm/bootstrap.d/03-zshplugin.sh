#!/bin/bash
set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${NC:=\033[0m}"

ZSH_PLUGINS_DIR="$HOME/.zsh"

install_zsh_plugin() {
    local name=$1
    local repo=$2
    local target_dir="$ZSH_PLUGINS_DIR/$name"

    if [[ -d "$target_dir" ]]; then
        return 0
    fi

    echo -e "${GREEN}正在下载插件: $name...${NC}"
    mkdir -p "$ZSH_PLUGINS_DIR"
    git clone --depth 1 "$repo" "$target_dir"
}

if ! command -v git >/dev/null 2>&1; then
    echo "错误: 未找到 git，请先安装 git" >&2
    exit 1
fi

install_zsh_plugin "zsh-autosuggestions" "https://github.com/zsh-users/zsh-autosuggestions"
install_zsh_plugin "zsh-syntax-highlighting" "https://github.com/zsh-users/zsh-syntax-highlighting"

echo -e "${GREEN}Bootstrap 完成！请重启终端或执行 'source ~/.zshrc'。${NC}"
