#!/bin/bash
set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${BLUE:=\033[0;34m}"
: "${NC:=\033[0m}"
: "${OS:=$(uname)}"

if command -v starship >/dev/null 2>&1; then
    echo -e "${BLUE}Starship 已安装，跳过。${NC}"
    exit 0
fi

echo -e "${GREEN}正在安装 Starship 提示符...${NC}"
if [[ "$OS" == "Darwin" ]]; then
    brew install starship
else
    curl -sS https://starship.rs/install.sh | sh -s -- -y
fi
