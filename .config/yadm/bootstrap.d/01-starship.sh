#!/bin/bash
# ABOUTME: 安装 Starship 跨平台提示符
# ABOUTME: macOS 使用 brew，Linux 使用官方安装脚本

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
    # 注意: 直接执行远程脚本存在 MITM 风险
    # 可选增强: 改用 brew install starship (Linuxbrew) 或下载校验过的二进制
    curl -sS https://starship.rs/install.sh | sh -s -- -y
fi