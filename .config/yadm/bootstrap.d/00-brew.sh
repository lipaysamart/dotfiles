#!/bin/bash
# ABOUTME: 安装 Homebrew 并通过 Brewfile 管理 macOS 软件包
# ABOUTME: 首次安装 Homebrew，然后执行 brew bundle --global 应用 Brewfile

set -euo pipefail

OS=$(uname -s)

if [[ "$OS" != "Darwin" ]]; then
    echo "Homebrew 安装脚本仅支持 macOS，跳过。"
    exit 0
fi

# install homebrew if it's missing
if ! command -v brew >/dev/null 2>&1; then
    echo "Installing homebrew"
    # 注意: 直接执行远程脚本存在 MITM 风险，这是 Homebrew 官方推荐方式
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [[ -f "$HOME/.Brewfile" ]]; then
    echo "Updating homebrew bundle"
    if ! brew bundle --global; then
        echo "提示: brew bundle 失败，请检查 ~/.Brewfile 是否有语法错误" >&2
        exit 1
    fi
fi