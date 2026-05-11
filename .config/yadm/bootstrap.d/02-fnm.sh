#!/bin/bash
# ABOUTME: 安装 fnm (Fast Node Manager) - Rust 编写的 Node.js 版本管理器
# ABOUTME: macOS 使用 brew，Linux 使用官方安装脚本

set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${BLUE:=\033[0;34m}"
: "${NC:=\033[0m}"
: "${OS:=$(uname)}"

if command -v fnm >/dev/null 2>&1; then
    echo -e "${BLUE}fnm 已安装，跳过。${NC}"
    exit 0
fi

echo -e "${GREEN}正在安装 fnm (Rust 编写的 Node 管理器)...${NC}"
if [[ "$OS" == "Darwin" ]]; then
    brew install fnm
else
    # 注意: 直接执行远程脚本存在 MITM 风险
    # 安装后需要添加到 PATH: eval "$(fnm env --shell bash)"
    curl -fsSL https://fnm.vercel.app/install | bash
fi