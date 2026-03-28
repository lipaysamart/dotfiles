---
name: cli-help-first
description: Before executing complex CLI tools (kubectl, docker, terraform, ansible, go, uv, vite, tailscale, vault, packer，vagrant), always check --help or man pages first to understand command syntax and parameters. Use this skill whenever the user asks to run commands with these tools, even for seemingly simple operations. This reduces hallucinations and retry errors by ensuring correct command construction.
---

# CLI Help-First

在使用复杂的命令行工具时，先查阅帮助文档可以显著减少错误和重试。

## 核心原则

在执行目标 CLI 工具命令之前，**必须先**通过 `--help` 或 `man` 理解命令的正确语法和参数。

## 适用工具

此技能适用于以下复杂 CLI 工具：

- **容器/编排**: `kubectl`, `docker`, `podman`
- **基础设施**: `terraform`, `ansible`, `packer`, `vagrant`
- **机密信息管理**: `vault`
- **开发工具**: `go`, `uv`, `bun`, `vite`
- **网络**: `tailscale`

**不需要**预先查阅帮助的常用 bash 命令：
`ls`, `cd`, `cp`, `mv`, `rm`, `mkdir`, `cat`, `echo`, `grep`, `find`, `git`, `sed`, `awk` 的常用操作（如 `git status`, `git add`, `git commit`, `git push`, `git pull`）

## 工作流程

### 1. 检查帮助缓存

首先检查本次会话中是否已缓存该工具的帮助信息。缓存存储在内存中，格式为：

```
<tool-name>_help_cached: true/false
```

如果已缓存，跳到步骤 3。

### 2. 获取帮助信息

优先使用 `--help`，如果输出不足或失败，再尝试 `man`：

```bash
<tool> --help          # 获取简短帮助
<tool> <subcommand> --help  # 获取子命令详细帮助
man <tool>             # 如果 --help 不够详细
```

获取后，标记该工具的帮助信息已缓存。

### 3. 理解并构建命令

根据帮助信息：

- 确认命令语法
- 识别必需参数和可选参数
- 理解参数格式要求
- 查看示例（如果有）

### 4. 执行命令

构建正确的命令并执行。如果遇到错误，重新查阅帮助信息确认。

## 示例

**示例 1：使用 kubectl 创建部署**

用户请求：使用 kubectl 创建一个 Nginx 副本

```
步骤 1: kubectl --help
步骤 2: kubectl create --help
步骤 3: kubectl create deployment --help
步骤 4: 执行: kubectl create deployment nginx --image=nginx
```

**示例 2：使用 docker 构建镜像**

用户请求：用 docker 构建一个名为 myapp 的镜像

```
步骤 1: docker --help
步骤 2: docker build --help
步骤 3: 执行: docker build -t myapp .
```

**示例 3：使用 terraform 创建资源**

用户请求：用 terraform 初始化并应用配置

```
步骤 1: terraform --help
步骤 2: terraform init --help
步骤 3: 执行 terraform init
步骤 4: terraform apply --help
步骤 5: 执行 terraform apply
```

## 注意事项

- 即使你"知道"某个命令的用法，仍然应该先查阅帮助，因为不同版本可能有差异
- 对于多级子命令，逐级查阅帮助（如 `kubectl` → `kubectl create` → `kubectl create deployment`）
- 帮助信息较长时，重点关注语法（SYNOPSIS）和示例（EXAMPLES）部分
- 如果命令失败，先检查帮助信息确认参数格式是否正确，而不是猜测修复
