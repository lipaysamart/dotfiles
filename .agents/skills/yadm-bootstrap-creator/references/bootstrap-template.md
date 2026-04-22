# Bootstrap Script Template

完整的 bootstrap 脚本结构模板：

```bash
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
    if check_command <tool-name>; then
        log_skip "<tool-name> 已安装"
        exit 0
    fi

    log_info "开始安装 <tool-name>..."

    OS=$(uname -s)
    
    case "$OS" in
        Darwin)
            if check_command brew; then
                brew install <package-name>
            else
                log_error "未找到 brew"
                exit 1
            fi
            ;;
        Linux)
            if check_command apt-get; then
                sudo apt-get update && sudo apt-get install -y <package-name>
            else
                log_error "未找到 apt-get，仅支持 Debian 系"
                exit 1
            fi
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac

    if check_command <tool-name>; then
        log_info "<tool-name> 安装成功"
    else
        log_error "<tool-name> 安装失败"
        exit 1
    fi
}

main "$@"
```

## Script Categories

### 1. Package Manager Installation (brew/apt)

```bash
brew install <package>           # macOS
apt-get install -y <package>     # Debian/Ubuntu
```

### 2. curl/wget Script Installation

```bash
if check_command curl; then
    curl -fsSL <install-url> | sh
else
    wget -qO- <install-url> | sh
fi
```

### 3. Git Clone Installation

```bash
TARGET_DIR="$HOME/.local/share/<name>"

if [[ -d "$TARGET_DIR" ]]; then
    log_skip "<name> 已存在"
    exit 0
fi

mkdir -p "$(dirname "$TARGET_DIR")"
git clone --depth 1 <repo-url> "$TARGET_DIR"
```

### 4. Binary Download Installation

```bash
VERSION=$(curl -fsSL https://api.github.com/repos/<owner>/<repo>/releases/latest | jq -r .tag_name)
curl -fsSL "https://github.com/<owner>/<repo>/releases/download/${VERSION}/<binary-name>" \
    -o "$HOME/.local/bin/<tool-name>"
chmod +x "$HOME/.local/bin/<tool-name>"
```