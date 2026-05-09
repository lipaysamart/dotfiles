#!/bin/bash
set -euo pipefail

: "${GREEN:=\033[0;32m}"
: "${BLUE:=\033[0;34m}"
: "${RED:=\033[0;31m}"
: "${NC:=\033[0m}"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_skip() { echo -e "${BLUE}[SKIP]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

main() {
    local SOURCE_DIR="$HOME/.agents"

    # Ensure source directory exists
    if [[ ! -d "$SOURCE_DIR" ]]; then
        log_error "源目录不存在: $SOURCE_DIR"
        exit 1
    fi

    # Define symlinks: <source>:<target_dir>
    # 目标路径自动推导为: <target_dir>/$(basename <source>)
    # 不同条目可指向不同的 target 目录
    local LINKS=(
        "$SOURCE_DIR/skills:$HOME/.config/opencode"
        "$SOURCE_DIR/commands:$HOME/.config/opencode"
        "$SOURCE_DIR/AGENTS.md:$HOME/.config/opencode"
        "$SOURCE_DIR/skills:$HOME/.pi/agent"
        "$SOURCE_DIR/commands:$HOME/.pi/agent"
        "$SOURCE_DIR/AGENTS.md:$HOME/.pi/agent"
    )

    local all_linked=true

    for entry in "${LINKS[@]}"; do
        local src="${entry%%:*}"
        local target_dir="${entry##*:}"
        local tgt="$target_dir/$(basename "$src")"

        if [[ ! -e "$src" ]]; then
            log_skip "源不存在，跳过: $src"
            continue
        fi

        # Auto-create target parent directory
        local tgt_parent
        tgt_parent="$(dirname "$tgt")"
        if [[ ! -d "$tgt_parent" ]]; then
            log_info "创建目标目录: $tgt_parent"
            mkdir -p "$tgt_parent"
        fi

        if [[ -L "$tgt" ]]; then
            local current
            current=$(readlink "$tgt")
            if [[ "$current" == "$src" ]]; then
                log_skip "符号链接已存在: $tgt -> $src"
                continue
            else
                log_info "更新符号链接: $tgt -> $src (之前指向 $current)"
                ln -sf "$src" "$tgt"
            fi
        elif [[ -e "$tgt" ]]; then
            log_error "目标路径已存在且不是符号链接，跳过: $tgt"
            all_linked=false
        else
            log_info "创建符号链接: $tgt -> $src"
            ln -s "$src" "$tgt"
        fi
    done

    if $all_linked; then
        log_info "所有 agents 符号链接已就绪"
    else
        log_error "部分符号链接创建失败，请手动处理"
        exit 1
    fi
}

main "$@"
