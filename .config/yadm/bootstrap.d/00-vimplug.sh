#!/bin/bash
set -euo pipefail

if ! command -v vim >/dev/null 2>&1; then
    exit 0
fi

VIM_AUTOLOAD_DIR="${XDG_DATA_HOME:-$HOME/.vim/autoload}"
VIM_PLUG_FILE="$VIM_AUTOLOAD_DIR/plug.vim"

if [[ ! -f "$VIM_PLUG_FILE" ]]; then
    echo "正在安装 vim-plug..."
    curl -fsSLo "$VIM_PLUG_FILE" --create-dirs \
        https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
fi

echo "正在 Bootstrap Vim..."
vim '+PlugUpdate' '+PlugClean!' '+PlugUpdate' '+qall'
