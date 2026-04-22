---
name: yadm-bootstrap-creator
description: |
  Create yadm bootstrap scripts for dotfiles management. Use this skill when the user asks to create, add, or write a bootstrap script, especially when they mention "yadm", "bootstrap", "dotfiles", or installing tools via bootstrap scripts. The skill generates numbered shell scripts that check for existing installations, support macOS and Debian-family Linux, and follow the user's existing bootstrap patterns.
---

## Templates

Read `references/bootstrap-template.md` for:
- Complete script structure (shebang, logging, idempotency check)
- Four installation methods: brew/apt, curl/wget, git clone, binary download

## Numbering Convention

| Prefix | Purpose |
|--------|---------|
| `00-` | Core infrastructure (brew, base tools) |
| `01-` to `49-` | Standard tools |
| `50-` to `99-` | Post-installation, plugins, configs |

**Auto-numbering:** `ls ~/.config/yadm/bootstrap.d/` → find highest → increment

## Workflow

1. **Gather Info** - Collect required information:
   - Tool name (required)
   - Installation method (required)
   - Package name or download URL (depends on method)
   
   If user provides insufficient info, use `question` tool to ask:
   - "安装什么工具？" - Tool name
   - "安装方式？" - Options: brew/apt, curl 脚本, git clone, 二进制下载
   - "包名？" - If different from tool name
   - "下载地址？" - For curl/git clone methods

2. **Check Existing** - Read bootstrap.d, determine next number

3. **Generate** - Select template, add idempotency check

4. **Create** - Write to `~/.config/yadm/bootstrap.d/{number}-{tool}.sh`, chmod +x