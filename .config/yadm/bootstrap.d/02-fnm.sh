#!/bin/bash
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
    curl -fsSL https://fnm.vercel.app/install | bash
fi
