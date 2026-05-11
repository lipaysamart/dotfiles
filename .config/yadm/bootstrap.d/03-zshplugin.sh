#!/bin/bash
# ABOUTME: 安装 zsh 插件 (zsh-autosuggestions, zsh-syntax-highlighting)
# ABOUTME: 克隆插件到 ~/.zsh 目录，支持幂等安装

set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${NC:=\033[0m}"

ZSH_PLUGINS_DIR="$HOME/.zsh"

install_zsh_plugin() {
    local name=$1
    local repo=$2
    local target_dir="$ZSH_PLUGINS_DIR/$name"

    # 检查 git 仓库完整性而非仅目录存在
    if [[ -f "$target_dir/.git/config" ]]; then
        echo -e "${GREEN}插件 $name 已存在，跳过。${NC}"
        return 0
    fi

    # 如果目录存在但不完整，先删除
    if [[ -d "$target_dir" ]]; then
        echo "清理不完整的插件目录: $name"
        rm -rf "$target_dir"
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